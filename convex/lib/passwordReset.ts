// Lógica del restablecimiento de contraseña (ARC-75), separada de Convex para
// poder probar los fallos parciales con dependencias simuladas. La cablea
// convex/adminAuth.ts.
//
// Orden y garantías (plan v5 de ARC-75):
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
// - La contraseña nunca sale de aquí: ni en logs, ni en errores, ni en el resultado.
// - No se revoca de forma inmediata una conexión ya autenticada: su JWT de acceso
//   sigue valiendo hasta caducar (1 h por defecto en @convex-dev/auth).

export const MIN_PASSWORD_LENGTH = 8;

// Una contraseña cargada por stdin desde Windows PowerShell 5.1 llega con un BOM
// (U+FEFF) delante y un salto de línea (CRLF) detrás: se guardaría como un hash de
// algo que nadie escribió y la cuenta quedaría bloqueada (verificado en dev). Se
// rechaza ANTES de tocar nada. Devuelve el motivo (sin incluir el valor) o null.
export function passwordProblem(password: string | undefined): string | null {
  if (!password) return "RESET_PASSWORD no está configurada";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `RESET_PASSWORD tiene menos de ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  for (const ch of password) {
    const code = ch.codePointAt(0)!;
    if (code <= 0x1f || code === 0x7f || code === 0xfeff) {
      return (
        "RESET_PASSWORD contiene un salto de línea, un carácter de control o un BOM (típico de " +
        "cargarla por stdin desde PowerShell 5.1). Cárgala con 'npx convex env set RESET_PASSWORD' " +
        "sin valor (entrada interactiva) o desde el panel web de Convex"
      );
    }
  }
  return null;
}
export const MAX_INVALIDATION_ATTEMPTS = 3;

// Destinos que puede escribir `updateAudit`. No incluye `iniciado` (lo escribe la
// apertura) ni `inconcluso_supersedido` (solo `supersederPrevios`).
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

export type SessionState = {
  sessionIds: string[];
  sessions: number;
  refreshTokens: number;
};

export type ResetDeps = {
  allowedEmails(): string[];
  readPassword(): string | undefined;
  findUserId(email: string): Promise<string | null>;
  newRequestId(): string;
  openAudit(requestId: string, userId: string): Promise<unknown>;
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

export async function runReset(deps: ResetDeps, rawEmail: string): Promise<ResetResult> {
  const email = normalizeEmail(rawEmail);
  if (!deps.allowedEmails().includes(email)) {
    throw new Error("Esa cuenta no está permitida para restablecer la contraseña");
  }
  const password = deps.readPassword();
  const problem = passwordProblem(password);
  if (problem !== null || password === undefined) {
    throw new Error(problem ?? "RESET_PASSWORD no está configurada");
  }
  const userId = await deps.findUserId(email);
  if (userId === null) {
    throw new Error("No existe una cuenta con ese email");
  }

  const requestId = deps.newRequestId();
  // Único punto en que un fallo de auditoría detiene la operación, y es antes de
  // intentar cambiar nada.
  await deps.openAudit(requestId, userId);

  // Mejor esfuerzo: un fallo aquí no puede impedir la invalidación.
  const tryAudit = async (patch: AuditPatch) => {
    try {
      await deps.updateAudit(requestId, patch);
      return true;
    } catch {
      return false;
    }
  };
  const log = (resultado: string) =>
    deps.log(`[resetPassword] requestId=${requestId} userId=${userId} resultado=${resultado}`);

  // Preparación: aún no se ha intentado cambiar nada, así que aquí sí es seguro
  // afirmar que la contraseña no se tocó.
  const seen = new Set<string>();
  try {
    const before = await deps.sessionState(userId, []);
    before.sessionIds.forEach((id) => seen.add(id));
  } catch {
    await tryAudit({ status: "fallo_preparacion", finishedAt: deps.now() });
    log("fallo_preparacion");
    throw new Error(
      `No se intentó cambiar la contraseña: falló la lectura previa de sesiones (requestId ${requestId})`,
    );
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
      throw new Error(
        `CAMBIO DE CONTRASEÑA NO CONFIRMADO. La contraseña anterior puede seguir siendo válida y pueden ` +
          `abrirse sesiones nuevas con ella; NO es un estado seguro. REINTENTA AHORA resetPassword, ` +
          `inmediatamente y hasta obtener el resultado A (requestId ${requestId}). ` +
          `NO retires RESET_PASSWORD ni cierres el incidente antes.`,
      );
    }
    await tryAudit({
      status: "cambio_no_confirmado",
      finishedAt: deps.now(),
      ...(alive !== undefined ? { sessionsRemaining: alive } : {}),
    });
    log("D2");
    throw new Error(
      `CRÍTICO: cambio de contraseña NO CONFIRMADO y sesiones/tokens NO invalidados; la contraseña ` +
        `anterior puede seguir siendo válida. REINTENTA AHORA hasta obtener el resultado A ` +
        `(requestId ${requestId}). NO retires RESET_PASSWORD.`,
    );
  }

  // C. Cambio confirmado pero sesiones no invalidadas.
  if (!verified) {
    await tryAudit({
      status: "fallo_invalidacion",
      finishedAt: deps.now(),
      ...(alive !== undefined ? { sessionsRemaining: alive } : {}),
    });
    log("C");
    throw new Error(
      `CONTRASEÑA CAMBIADA pero las sesiones NO se han invalidado: vuelve a ejecutar (requestId ${requestId})`,
    );
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
