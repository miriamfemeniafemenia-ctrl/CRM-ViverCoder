// Lógica del restablecimiento de contraseña (ARC-75), separada de Convex para
// poder probar los fallos parciales con dependencias simuladas. La cablea
// convex/adminAuth.ts.
//
// Arquitectura (plan v7):
// - `resetPassword` (la invoca el operador) solo SOLICITA el reset y espera: el
//   trabajo de riesgo lo hace `ejecutarReset`, una action PROGRAMADA. El estado de
//   una función programada lo escribe la plataforma (`_scheduled_functions`), así
//   que "¿sigue viva la ejecución?" no depende de ninguna escritura de auditoría
//   que pueda fallar. Solo hay un reset vivo en todo el sistema.
// - A la acción programada solo se le pasan identificadores opacos
//   ({ requestId, userId }): Convex conserva sus argumentos días en
//   `_scheduled_functions`, y el email nunca debe quedar ahí.
//
// Garantías del trabajo (`runReset`):
// - Antes de intentar cambiar nada, cualquier fallo aborta sin tocar datos.
// - Desde que se invoca `modifyPassword`, la invalidación y la verificación de
//   sesiones y refresh tokens son OBLIGATORIAS en cualquier desenlace, también si
//   `modifyPassword` lanza: un error de transporte puede ocultar un commit efectivo
//   y una sesión renovable no puede quedar viva. Un fallo de auditoría nunca la
//   interrumpe (cada escritura va en su propio try/catch).
// - Nunca se afirma lo que no se puede demostrar. Si `modifyPassword` lanza, no se
//   sabe si el hash cambió: el resultado es D (`cambio_no_confirmado`), que NO es
//   un estado seguro (la contraseña anterior puede seguir siendo válida y abrir
//   sesiones nuevas) y exige reintentar hasta A. Una sesión posterior a la
//   verificación solo es «legítima» en A/B/C, donde el cambio está confirmado.
// - `sessionsAbsentAfterCheck` se escribe solo tras una verificación completa a 0
//   y significa «sesiones observadas antes y que ya no existían al verificar»; no
//   prueba que esta acción las invalidara.
// - La contraseña y el email nunca salen de aquí: ni en logs, ni en errores, ni en
//   el resultado.
// - No se revoca de forma inmediata una conexión ya autenticada: su JWT de acceso
//   sigue valiendo hasta caducar (1 h por defecto en @convex-dev/auth).

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_INVALIDATION_ATTEMPTS = 3;
export const AUDIT_WRITE_ATTEMPTS = 3;

// Espera máxima de la envoltura al resultado (ms). La variable RESET_ESPERA_MAX_MS
// (no sensible) existe solo para pruebas y NO está documentada para producción: se
// valida (finita, entre el mínimo y el máximo) y, si no cumple, rige el valor por
// defecto. El máximo queda muy por debajo del límite de una action del runtime.
export const ESPERA_MAX_MS_POR_DEFECTO = 120_000;
export const ESPERA_MAX_MS_MINIMA = 100;
export const ESPERA_MAX_MS_MAXIMA = 300_000;
export function esperaMaxMs(raw: string | undefined): number {
  const valor = Number(raw);
  if (
    raw === undefined ||
    raw.trim() === "" ||
    !Number.isFinite(valor) ||
    valor < ESPERA_MAX_MS_MINIMA ||
    valor > ESPERA_MAX_MS_MAXIMA
  ) {
    return ESPERA_MAX_MS_POR_DEFECTO;
  }
  return valor;
}

// Red de seguridad, NO el mecanismo normal de liberación: el límite de una action
// del runtime Convex es de 30 min (10 en Node); se usa el más conservador + 5 min
// de margen. Un registro no terminal más antiguo que esto no puede tener una
// ejecución viva, aunque la plataforma dejara su función programada en
// pending/inProgress o ya hubiera purgado su fila.
export const LEASE_MS = 35 * 60 * 1000;

// Una contraseña cargada por stdin desde Windows PowerShell 5.1 llega con un BOM
// (U+FEFF) delante y un salto de línea (CRLF) detrás: se guardaría como un hash de
// algo que nadie escribió y la cuenta quedaría bloqueada (verificado en dev). Se
// rechaza ANTES de tocar nada. Rechaza las categorías Unicode Cc, Cf, Zl y Zp
// (controles C0/C1, DEL, espacios de ancho cero y marcas bidi, BOM, U+2028/2029).
// Los espacios iniciales/finales NO se prohíben ni se recortan: son significativos.
// Devuelve el motivo (sin incluir el valor) o null.
const FORBIDDEN_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
export function passwordProblem(password: string | undefined): string | null {
  if (!password) return "RESET_PASSWORD no está configurada";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `RESET_PASSWORD tiene menos de ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (FORBIDDEN_CHARS.test(password)) {
    return (
      "RESET_PASSWORD contiene un salto de línea, un carácter de control, invisible o de formato, o un BOM " +
      "(típico de cargarla por stdin desde PowerShell 5.1). Cárgala con 'npx convex env set RESET_PASSWORD' " +
      "sin valor (entrada interactiva) o desde el panel web de Convex. Los espacios al principio o al " +
      "final son significativos y no se recortan"
    );
  }
  return null;
}

// Destinos que puede escribir `updateAudit`. No incluye `iniciado` (lo escribe la
// solicitud) ni `inconcluso_supersedido` (solo `supersederPrevios`).
export type AuditStatus =
  | "fallo_preparacion"
  | "cambio_no_confirmado"
  | "contrasena_cambiada"
  | "completado"
  | "fallo_invalidacion";

export type AuditPatch = {
  status: AuditStatus;
  finishedAt?: number;
  sessionsAbsentAfterCheck?: number;
  sessionsRemaining?: number;
};

// Estados NO terminales: una ejecución en vuelo (o que murió sin cerrar su registro).
export const NON_TERMINAL_STATUSES: readonly string[] = ["iniciado", "contrasena_cambiada"];

// Transiciones permitidas. Solo `iniciado` y `contrasena_cambiada` admiten
// cambios; todo estado terminal (completado, fallo_preparacion,
// cambio_no_confirmado, fallo_invalidacion, inconcluso_supersedido) es inmutable.
// Los saltos desde `iniciado` son legítimos: las escrituras de auditoría son de
// mejor esfuerzo y la de `contrasena_cambiada` puede fallar sin impedir el cierre.
export const TRANSITIONS: Record<string, readonly AuditStatus[]> = {
  iniciado: [
    "fallo_preparacion",
    "cambio_no_confirmado",
    "contrasena_cambiada",
    "completado",
    "fallo_invalidacion",
  ],
  contrasena_cambiada: ["completado", "fallo_invalidacion"],
};

export function canTransition(from: string, to: string) {
  return (TRANSITIONS[from] as readonly string[] | undefined)?.includes(to) ?? false;
}

// Registros que quedaron sin resolver: los resuelve un reset posterior en A
// (`supersederPrevios`). `fallo_preparacion` no está: nada cambió con certeza.
export const UNRESOLVED_STATUSES: readonly string[] = [
  "iniciado",
  "contrasena_cambiada",
  "cambio_no_confirmado",
  "fallo_invalidacion",
];

// Orden causal estricto: `previo` solo lo es si se creó ANTES (menor estricto).
// Con la misma marca temporal el orden no está probado, así que no es previo.
export function esPrevio(previo: { _creationTime: number }, record: { _creationTime: number }) {
  return previo._creationTime < record._creationTime;
}

// Estado de la función programada según la plataforma (`_scheduled_functions`);
// `null` = la fila ya no existe.
export type EstadoProgramado = "pending" | "inProgress" | "success" | "failed" | "canceled";

// ¿Puede seguir viva la ejecución de un registro? La evidencia es el estado de la
// función programada: solo pending/inProgress cuentan como vivas, y en cuanto
// termina (success/failed/canceled) el bloqueo se libera AL INSTANTE, aunque su
// registro de auditoría haya quedado sin cerrar. LEASE_MS solo corta los casos de
// fallo de plataforma: una ejecución más antigua que el límite del runtime no puede
// seguir viva. Una fila purgada (`null`) y reciente se trata como viva (conservador).
export function ejecucionViva(estado: EstadoProgramado | null, startedAt: number, ahora: number) {
  if (ahora - startedAt >= LEASE_MS) return false;
  if (estado === null) return true;
  return estado === "pending" || estado === "inProgress";
}

// Un registro bloquea nuevos resets si no es terminal y su ejecución puede seguir viva.
export function registroBloquea(
  registro: { status: string; startedAt: number },
  estado: EstadoProgramado | null,
  ahora: number,
) {
  return NON_TERMINAL_STATUSES.includes(registro.status) && ejecucionViva(estado, registro.startedAt, ahora);
}

export type SessionState = {
  sessionIds: string[];
  sessions: number;
  refreshTokens: number;
};

export type ResetDeps = {
  readPassword(): string | undefined;
  // Resuelve el email de la cuenta SIN que salga de la configuración (lanza si no puede).
  resolveEmail(userId: string): Promise<string>;
  updateAudit(requestId: string, patch: AuditPatch): Promise<unknown>;
  sessionState(userId: string, knownSessionIds: string[]): Promise<SessionState>;
  modifyPassword(email: string, password: string): Promise<void>;
  invalidateSessions(userId: string): Promise<void>;
  superseder(requestId: string): Promise<number>;
  now(): number;
  log(message: string): void;
};

export type ResetResult = {
  ok: true;
  requestId: string;
  // B: el reset es seguro pero la auditoría no pudo cerrarse como `completado`.
  auditoriaPendiente?: true;
  // A con fallo al supersedar: el reset no se degrada, el historial previo sigue pendiente.
  historialPrevioPendiente?: true;
  registrosSupersedidos?: number;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Mensajes canónicos. El operador solo recibe estos (nunca texto de plataforma).
export const mensajePreparacion = (requestId: string) =>
  `No se intentó cambiar la contraseña: falló la preparación previa (RESET_PASSWORD no válida, cuenta no ` +
  `resoluble o lectura de sesiones) (requestId ${requestId}). Comprueba estadoRestablecimiento y vuelve a ejecutar.`;

export const mensajeC = (requestId: string) =>
  `CONTRASEÑA CAMBIADA pero las sesiones NO se han invalidado: vuelve a ejecutar (requestId ${requestId})`;

export const mensajeD1 = (requestId: string) =>
  `CAMBIO DE CONTRASEÑA NO CONFIRMADO. La contraseña anterior puede seguir siendo válida y pueden ` +
  `abrirse sesiones nuevas con ella; NO es un estado seguro. REINTENTA AHORA resetPassword, ` +
  `inmediatamente y hasta obtener el resultado A (requestId ${requestId}). ` +
  `NO retires RESET_PASSWORD ni cierres el incidente antes.`;

export const mensajeD2 = (requestId: string) =>
  `CRÍTICO: cambio de contraseña NO CONFIRMADO y sesiones/tokens NO invalidados; la contraseña ` +
  `anterior puede seguir siendo válida. REINTENTA AHORA hasta obtener el resultado A ` +
  `(requestId ${requestId}). NO retires RESET_PASSWORD.`;

export const mensajeSinClasificar = (requestId: string) =>
  `El restablecimiento terminó sin poder registrar su estado (requestId ${requestId}). Trátalo como D2: ` +
  `la contraseña anterior puede seguir siendo válida y pueden quedar sesiones vivas; REINTENTA AHORA ` +
  `hasta obtener el resultado A; NO retires RESET_PASSWORD.`;

export const mensajeEnCurso = (requestId: string) =>
  `El restablecimiento sigue en curso (requestId ${requestId}). No lances otro: consulta ` +
  `adminAuth:resultadoReset con ese requestId hasta que termine.`;

export type Ejecucion = EstadoProgramado | "desconocida";
export type RegistroVista = {
  estado: string;
  sessionsAbsentAfterCheck?: number;
  sessionsRemaining?: number;
} | null;
export type Clasificacion =
  | { kind: "esperar" }
  | { kind: "ok"; result: ResetResult }
  | { kind: "error"; message: string };

// Reconstruye el resultado SOLO a partir del estado de la plataforma y del registro
// de auditoría; nunca de `state.error` ni de texto de excepciones.
export function clasificarResultado(
  requestId: string,
  ejecucion: Ejecucion,
  registro: RegistroVista,
  previosSinResolver: number,
): Clasificacion {
  if (ejecucion === "pending" || ejecucion === "inProgress") return { kind: "esperar" };
  const estado = registro?.estado;
  if (ejecucion === "success") {
    if (estado === "completado") {
      return {
        kind: "ok",
        result: {
          ok: true,
          requestId,
          ...(previosSinResolver > 0 ? { historialPrevioPendiente: true as const } : {}),
        },
      };
    }
    if (estado === "iniciado" || estado === "contrasena_cambiada") {
      return { kind: "ok", result: { ok: true, requestId, auditoriaPendiente: true } };
    }
    return { kind: "error", message: mensajeSinClasificar(requestId) };
  }
  // failed / canceled / desconocida
  if (estado === "fallo_preparacion") return { kind: "error", message: mensajePreparacion(requestId) };
  if (estado === "fallo_invalidacion") return { kind: "error", message: mensajeC(requestId) };
  if (estado === "cambio_no_confirmado") {
    const d1 = registro!.sessionsRemaining === 0 && registro!.sessionsAbsentAfterCheck !== undefined;
    return { kind: "error", message: d1 ? mensajeD1(requestId) : mensajeD2(requestId) };
  }
  return { kind: "error", message: mensajeSinClasificar(requestId) };
}

export async function runReset(
  deps: ResetDeps,
  args: { requestId: string; userId: string },
): Promise<ResetResult> {
  const { requestId, userId } = args;

  // Mejor esfuerzo: un fallo aquí no puede impedir la invalidación. Las escrituras
  // se reintentan hasta AUDIT_WRITE_ATTEMPTS veces antes de rendirse.
  const tryAudit = async (patch: AuditPatch) => {
    for (let attempt = 1; attempt <= AUDIT_WRITE_ATTEMPTS; attempt++) {
      try {
        await deps.updateAudit(requestId, patch);
        return true;
      } catch {
        // se reintenta
      }
    }
    return false;
  };
  const log = (resultado: string) =>
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=${resultado}`);

  // Preparación: aún no se ha intentado cambiar nada, así que aquí sí es seguro
  // afirmar que la contraseña no se tocó.
  const seen = new Set<string>();
  let email: string;
  let password: string;
  try {
    const candidate = deps.readPassword();
    if (passwordProblem(candidate) !== null || candidate === undefined) {
      throw new Error("RESET_PASSWORD no válida");
    }
    password = candidate;
    email = await deps.resolveEmail(userId);
    const before = await deps.sessionState(userId, []);
    before.sessionIds.forEach((id) => seen.add(id));
  } catch {
    await tryAudit({ status: "fallo_preparacion", finishedAt: deps.now() });
    log("fallo_preparacion");
    throw new Error(mensajePreparacion(requestId));
  }

  // Desde aquí, un error de `modifyPassword` NO demuestra que el hash no cambiara.
  let cambioNoConfirmado = false;
  try {
    await deps.modifyPassword(email, password);
  } catch {
    cambioNoConfirmado = true;
  }
  if (!cambioNoConfirmado) await tryAudit({ status: "contrasena_cambiada" });

  // Invalidación y verificación: obligatorias en cualquier desenlace.
  let remaining: { sessions: number; refreshTokens: number } | null = null;
  for (let attempt = 1; attempt <= MAX_INVALIDATION_ATTEMPTS; attempt++) {
    try {
      await deps.invalidateSessions(userId);
    } catch {
      // Se sigue: el recuento de abajo es la prueba, no la ausencia de error.
    }
    try {
      const state = await deps.sessionState(userId, [...seen]);
      state.sessionIds.forEach((id) => seen.add(id));
      remaining = { sessions: state.sessions, refreshTokens: state.refreshTokens };
    } catch {
      remaining = null;
    }
    if (remaining !== null && remaining.sessions === 0 && remaining.refreshTokens === 0) break;
  }
  const verified =
    remaining !== null && remaining.sessions === 0 && remaining.refreshTokens === 0;
  const alive = remaining ? remaining.sessions + remaining.refreshTokens : undefined;

  // D. Cambio NO confirmado: nunca éxito, y NO es un estado seguro.
  if (cambioNoConfirmado) {
    if (verified) {
      await tryAudit({
        status: "cambio_no_confirmado",
        finishedAt: deps.now(),
        sessionsAbsentAfterCheck: seen.size,
        sessionsRemaining: 0,
      });
      log("D1");
      throw new Error(mensajeD1(requestId));
    }
    await tryAudit({
      status: "cambio_no_confirmado",
      finishedAt: deps.now(),
      ...(alive !== undefined ? { sessionsRemaining: alive } : {}),
    });
    log("D2");
    throw new Error(mensajeD2(requestId));
  }

  // C. Cambio confirmado pero sesiones no invalidadas.
  if (!verified) {
    await tryAudit({
      status: "fallo_invalidacion",
      finishedAt: deps.now(),
      ...(alive !== undefined ? { sessionsRemaining: alive } : {}),
    });
    log("C");
    throw new Error(mensajeC(requestId));
  }

  const closed = await tryAudit({
    status: "completado",
    finishedAt: deps.now(),
    sessionsAbsentAfterCheck: seen.size,
    sessionsRemaining: 0,
  });
  if (!closed) {
    log("B");
    return { ok: true, requestId, auditoriaPendiente: true };
  }

  // Resultado A. La supersesión de registros previos va en una mutation posterior
  // y su fallo no degrada el reset.
  try {
    const registrosSupersedidos = await deps.superseder(requestId);
    log("A");
    return { ok: true, requestId, registrosSupersedidos };
  } catch {
    log("A historialPrevioPendiente");
    return { ok: true, requestId, historialPrevioPendiente: true };
  }
}
