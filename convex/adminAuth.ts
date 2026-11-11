import { invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  QueryCtx,
} from "./_generated/server";
import {
  canTransition,
  clasificarResultado,
  type Ejecucion,
  esPrevio,
  esperaMaxMs,
  mensajeEnCurso,
  normalizeEmail,
  passwordProblem,
  registroBloquea,
  runReset,
  type ResetResult,
  UNRESOLVED_STATUSES,
} from "./lib/passwordReset";

// ARC-75 — Restablecer la contraseña de una de las 3 cuentas fijas. Todo es
// `internal*`: no se puede llamar desde la app, solo con `npx convex run`
// (acceso administrativo a Convex). Procedimiento seguro en el README
// (sección Autenticación): la nueva contraseña va en la variable de entorno
// RESET_PASSWORD, cargada sin escribirla en la línea de comandos, y se borra
// al terminar (solo tras un resultado A). Nunca es un argumento.
//
// Qué garantiza y qué no: tras un resultado A, la contraseña antigua deja de valer
// y se borran las sesiones y los refresh tokens de la cuenta, así que no se pueden
// abrir ni renovar sesiones con la credencial anterior. En D1/D2 (cambio no
// confirmado) la contraseña anterior PUEDE seguir siendo válida hasta alcanzar A.
// NO revoca de forma inmediata una pestaña ya autenticada: su JWT de acceso sigue
// valiendo hasta caducar (1 hora por defecto en @convex-dev/auth 0.0.94; auth.ts
// no la cambia).
//
// Arquitectura: `resetPassword` (la que lanza el operador) solo SOLICITA el reset y
// espera su resultado; el trabajo lo hace `ejecutarReset`, una action PROGRAMADA.
// El estado de una función programada lo escribe la plataforma, y es la evidencia
// de que una ejecución sigue viva (exclusión mutua global): no depende de ninguna
// escritura de auditoría que pueda fallar. A la acción programada solo se le pasan
// `{ requestId, userId }`: Convex conserva sus argumentos días en
// `_scheduled_functions`, y el email no debe quedar ahí. Ninguna función de este
// archivo devuelve emails.
//
// La lógica y el orden de los pasos están en lib/passwordReset.ts.

const EXECUTOR = "acceso administrativo Convex (CLI)";

// Las 3 cuentas permitidas, por el nombre de su variable (las mismas que usa
// seed.ts). Sin emails en el código.
const ACCOUNT_NAMES = ["MIRIAM", "MONICA", "ANTONIO"] as const;
type AccountName = (typeof ACCOUNT_NAMES)[number];

// Búsqueda ÚNICA de la cuenta: provider "password" y providerAccountId igual al
// email normalizado. Devuelve solo el id: nunca el documento (lleva el hash).
async function buscarCuentaPassword(ctx: QueryCtx, email: string) {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "password").eq("providerAccountId", email),
    )
    .unique();
  return account?.userId ?? null;
}

// Configuración ESTRICTA de las 3 cuentas (falla cerrada). Los emails nunca salen de
// este helper: lo consumen funciones que devuelven solo booleanos, números e ids.
// `alineada` exige a la vez: las tres variables configuradas, emails distintos, las
// tres con cuenta password real y los tres userId DISTINTOS (Convex Auth puede
// asociar varias cuentas a un mismo usuario; con un userId repetido no se sabría
// qué cuenta se pidió). No se filtra ninguna variable ausente.
async function leerConfiguracion(ctx: QueryCtx) {
  const cuentas: {
    nombre: AccountName;
    variableConfigurada: boolean;
    email: string | null;
    userId: Id<"users"> | null;
  }[] = [];
  for (const nombre of ACCOUNT_NAMES) {
    const raw = process.env[`SEED_${nombre}_EMAIL`];
    const email = raw ? normalizeEmail(raw) : null;
    const userId = email ? await buscarCuentaPassword(ctx, email) : null;
    cuentas.push({ nombre, variableConfigurada: Boolean(raw), email, userId });
  }
  const emails = cuentas.map((c) => c.email);
  const userIds = cuentas.map((c) => c.userId);
  const alineada =
    cuentas.every((c) => c.variableConfigurada && c.email !== null && c.userId !== null) &&
    new Set(emails).size === cuentas.length &&
    new Set(userIds).size === cuentas.length;
  return { cuentas, alineada };
}

// Estado de la función programada de un registro según la plataforma (o null si la
// fila ya no existe).
async function estadoProgramado(ctx: QueryCtx, programadoId: Id<"_scheduled_functions">) {
  const job = await ctx.db.system.get(programadoId);
  return job ? job.state.kind : null;
}

// Solo lectura. Antes de un reset, comprueba que las tres variables SEED_*_EMAIL
// están alineadas con cuentas reales (si no, el reset falla cerrado). Solo
// devuelve el nombre de cada variable y booleanos: nunca emails ni hashes.
export const diagnosticoCuentas = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await leerConfiguracion(ctx);
    return {
      cuentas: cfg.cuentas.map((c) => ({
        nombre: c.nombre,
        variableConfigurada: c.variableConfigurada,
        cuentaEncontrada: c.userId !== null,
      })),
      todasAlineadas: cfg.alineada,
    };
  },
});

// Para la acción programada: de `userId` a NOMBRE de variable ("MIRIAM"…). No es
// PII y evita pasar el email como argumento programado. Null si la configuración no
// está alineada o el usuario no es de los tres.
export const cuentaDeUsuario = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const cfg = await leerConfiguracion(ctx);
    if (!cfg.alineada) return null;
    return cfg.cuentas.find((c) => c.userId === args.userId)?.nombre ?? null;
  },
});

// `authRefreshTokens` solo se indexa por sesión: se cuentan los de las sesiones
// actuales y los de las ya vistas (`knownSessionIds`), que tras borrarlas ya no
// se encontrarían por usuario.
export const sessionState = internalQuery({
  args: { userId: v.id("users"), knownSessionIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    const sessionIds = new Set<string>([...args.knownSessionIds, ...sessions.map((s) => s._id)]);
    let refreshTokens = 0;
    for (const sessionId of sessionIds) {
      const id = ctx.db.normalizeId("authSessions", sessionId);
      if (id === null) continue;
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", id))
        .collect();
      refreshTokens += tokens.length;
    }
    return { sessionIds: [...sessionIds], sessions: sessions.length, refreshTokens };
  },
});

// Fase previa, ATÓMICA: valida la configuración estricta, la lista cerrada y
// RESET_PASSWORD, comprueba la exclusión mutua GLOBAL (un solo reset vivo en todo
// el sistema: RESET_PASSWORD es una variable global y no se liga a la solicitud, y
// si cambiara entre la solicitud y la ejecución la acción pendiente aplicaría la
// contraseña preparada para otra cuenta), programa el trabajo con identificadores
// opacos e inserta el registro `iniciado`. Si algo falla no queda nada.
export const solicitarReset = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ requestId: string }> => {
    const cfg = await leerConfiguracion(ctx);
    if (!cfg.alineada) {
      throw new Error("Configuración no alineada: ejecuta adminAuth:diagnosticoCuentas");
    }
    const cuenta = cfg.cuentas.find((c) => c.email === normalizeEmail(args.email));
    if (!cuenta || cuenta.userId === null) {
      throw new Error("Esa cuenta no está permitida para restablecer la contraseña");
    }
    const problem = passwordProblem(process.env.RESET_PASSWORD);
    if (problem !== null) throw new Error(problem);

    // Exclusión mutua global: cualquier registro no terminal de CUALQUIERA de las
    // tres cuentas cuya función programada siga pending/inProgress bloquea.
    const ahora = Date.now();
    for (const c of cfg.cuentas) {
      const registros = await ctx.db
        .query("passwordResetAudit")
        .withIndex("by_userId", (q) => q.eq("userId", c.userId!))
        .collect();
      for (const registro of registros) {
        const estado = await estadoProgramado(ctx, registro.programadoId);
        if (registroBloquea(registro, estado, ahora)) {
          throw new Error(mensajeEnCurso(registro.requestId));
        }
      }
    }

    const requestId = crypto.randomUUID();
    // Solo identificadores opacos: nunca el email ni la contraseña.
    const programadoId = await ctx.scheduler.runAfter(0, internal.adminAuth.ejecutarReset, {
      requestId,
      userId: cuenta.userId,
    });
    await ctx.db.insert("passwordResetAudit", {
      requestId,
      userId: cuenta.userId,
      startedAt: ahora,
      status: "iniciado",
      executor: EXECUTOR,
      programadoId,
    });
    return { requestId };
  },
});

// Tabla de transiciones aplicada aquí (el validador solo acota los destinos):
// solo se modifica un registro en `iniciado` o `contrasena_cambiada`; los
// terminales son inmutables. `inconcluso_supersedido` no es un destino válido (solo
// lo escribe `supersederPrevios`) y no existe ningún estado de «reparado».
export const updateAudit = internalMutation({
  args: {
    requestId: v.string(),
    status: v.union(
      v.literal("fallo_preparacion"),
      v.literal("cambio_no_confirmado"),
      v.literal("contrasena_cambiada"),
      v.literal("completado"),
      v.literal("fallo_invalidacion"),
    ),
    finishedAt: v.optional(v.number()),
    sessionsAbsentAfterCheck: v.optional(v.number()),
    sessionsRemaining: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { requestId, ...patch } = args;
    const record = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
      .unique();
    if (record === null) throw new Error("No existe ese registro de auditoría");
    if (!canTransition(record.status, patch.status)) {
      throw new Error(`Transición de auditoría no permitida: ${record.status} → ${patch.status}`);
    }
    await ctx.db.patch(record._id, patch);
  },
});

// Marca los registros previos sin resolver del MISMO usuario como inconclusos,
// con referencia al reset completado que los sustituye. Solo con un `requestId`
// en `completado`; excluye el propio registro y exige orden causal estricto
// (`esPrevio`: creados ANTES); no toca una ejecución que siga viva (por la
// exclusión mutua no debería existir); idempotente (solo actúa sobre los que
// siguen sin resolver). Es el único camino que mueve registros terminales a
// `inconcluso_supersedido`. No afirma que hubiera o no cambio de contraseña en los
// previos.
export const supersederPrevios = internalMutation({
  args: { requestId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (record === null || record.status !== "completado") {
      throw new Error("Solo se puede supersedar con un reset en estado completado");
    }
    const previos = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_userId", (q) => q.eq("userId", record.userId))
      .collect();
    const ahora = Date.now();
    let superseded = 0;
    for (const previo of previos) {
      if (
        previo._id === record._id ||
        !esPrevio(previo, record) ||
        !UNRESOLVED_STATUSES.includes(previo.status)
      ) {
        continue;
      }
      const estado = await estadoProgramado(ctx, previo.programadoId);
      if (registroBloquea(previo, estado, ahora)) continue;
      await ctx.db.patch(previo._id, {
        status: "inconcluso_supersedido",
        supersededBy: record.requestId,
      });
      superseded++;
    }
    return superseded;
  },
});

// Registros previos (de este usuario) todavía sin resolver: sirve a la envoltura
// para avisar de `historialPrevioPendiente`. Solo devuelve un número.
export const previosSinResolver = internalQuery({
  args: { requestId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (record === null) return 0;
    const registros = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_userId", (q) => q.eq("userId", record.userId))
      .collect();
    return registros.filter(
      (r) => r._id !== record._id && esPrevio(r, record) && UNRESOLVED_STATUSES.includes(r.status),
    ).length;
  },
});

// Vista segura de una ejecución: SOLO códigos. No devuelve `state.error` de la
// plataforma (puede llevar detalles internos o PII), ni userId, ni emails.
export const resultadoReset = internalQuery({
  args: { requestId: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (record === null) {
      return { ejecucion: "desconocida" as Ejecucion, registro: null };
    }
    const estado = await estadoProgramado(ctx, record.programadoId);
    return {
      ejecucion: (estado ?? "desconocida") as Ejecucion,
      registro: {
        estado: record.status as string,
        sessionsAbsentAfterCheck: record.sessionsAbsentAfterCheck,
        sessionsRemaining: record.sessionsRemaining,
      },
    };
  },
});

// El trabajo: action PROGRAMADA (un único intento; Convex no reintenta actions).
// Firma definitiva `{ requestId, userId }`: sin email ni contraseña en los argumentos
// que la plataforma conserva. El email se resuelve aquí por nombre de variable.
export const ejecutarReset = internalAction({
  args: { requestId: v.string(), userId: v.id("users") },
  handler: async (ctx, args): Promise<ResetResult> =>
    runReset(
      {
        readPassword: () => process.env.RESET_PASSWORD,
        resolveEmail: async (userId) => {
          const nombre = await ctx.runQuery(internal.adminAuth.cuentaDeUsuario, {
            userId: userId as Id<"users">,
          });
          const raw = nombre ? process.env[`SEED_${nombre}_EMAIL`] : undefined;
          if (!raw) throw new Error("No se pudo resolver la cuenta");
          return normalizeEmail(raw);
        },
        updateAudit: (requestId, patch) =>
          ctx.runMutation(internal.adminAuth.updateAudit, { requestId, ...patch }),
        sessionState: (userId, knownSessionIds) =>
          ctx.runQuery(internal.adminAuth.sessionState, {
            userId: userId as Id<"users">,
            knownSessionIds,
          }),
        modifyPassword: (email, password) =>
          modifyAccountCredentials(ctx, {
            provider: "password",
            account: { id: email, secret: password },
          }),
        invalidateSessions: (userId) =>
          invalidateSessions(ctx, { userId: userId as Id<"users"> }),
        superseder: (requestId) =>
          ctx.runMutation(internal.adminAuth.supersederPrevios, { requestId }),
        now: () => Date.now(),
        log: (message) => console.log(message),
      },
      { requestId: args.requestId, userId: args.userId },
    ),
});

// La envoltura que lanza el operador: solicita el reset, espera a que termine la
// función programada y devuelve o lanza SOLO mensajes canónicos reconstruidos desde
// el estado de la plataforma y el registro de auditoría (nunca texto de excepciones).
export const resetPassword = internalAction({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<ResetResult> => {
    const { requestId } = await ctx.runMutation(internal.adminAuth.solicitarReset, {
      email: args.email,
    });
    // Validada (finita, entre un mínimo y un máximo); solo para pruebas.
    const limite = Date.now() + esperaMaxMs(process.env.RESET_ESPERA_MAX_MS);
    let pausa = 200;
    for (;;) {
      const vista = await ctx.runQuery(internal.adminAuth.resultadoReset, { requestId });
      const terminada = vista.ejecucion !== "pending" && vista.ejecucion !== "inProgress";
      const previos =
        terminada && vista.registro?.estado === "completado"
          ? await ctx.runQuery(internal.adminAuth.previosSinResolver, { requestId })
          : 0;
      const clasificacion = clasificarResultado(requestId, vista.ejecucion, vista.registro, previos);
      if (clasificacion.kind === "ok") return clasificacion.result;
      if (clasificacion.kind === "error") throw new Error(clasificacion.message);
      if (Date.now() >= limite) throw new Error(mensajeEnCurso(requestId));
      await new Promise((resolve) => setTimeout(resolve, pausa));
      pausa = Math.min(pausa + 200, 1000);
    }
  },
});

// Registros sin resolver y ejecución viva de las tres cuentas. Con la
// configuración incompleta NUNCA devuelve un 0 apto para cierre: devuelve null.
// Consulta el índice `by_userId` por usuario: no escanea la tabla completa.
export const estadoCuentas = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cfg = await leerConfiguracion(ctx);
    if (!cfg.alineada) {
      return {
        alineada: false,
        registrosSinResolver: null as number | null,
        resetEnCurso: null as boolean | null,
      };
    }
    const ahora = Date.now();
    let registrosSinResolver = 0;
    let resetEnCurso = false;
    for (const c of cfg.cuentas) {
      const registros = await ctx.db
        .query("passwordResetAudit")
        .withIndex("by_userId", (q) => q.eq("userId", c.userId!))
        .collect();
      for (const registro of registros) {
        if (UNRESOLVED_STATUSES.includes(registro.status)) registrosSinResolver++;
        const estado = await estadoProgramado(ctx, registro.programadoId);
        if (registroBloquea(registro, estado, ahora)) resetEnCurso = true;
      }
    }
    return { alineada: true, registrosSinResolver: registrosSinResolver as number | null, resetEnCurso: resetEnCurso as boolean | null };
  },
});

// Permite comprobar que RESET_PASSWORD está cargada y es válida, o que se borró,
// sin enumerar variables ni leer su valor, y si el cierre del incidente es seguro.
// `cierrePermitido` es el criterio único: variable RESET_PASSWORD eliminada,
// configuración alineada, 0 registros sin resolver y ningún reset vivo.
export const estadoRestablecimiento = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    contrasenaConfigurada: boolean;
    contrasenaEliminada: boolean;
    contrasenaValida: boolean;
    configuracionAlineada: boolean;
    registrosSinResolver: number | null;
    resetEnCurso: boolean | null;
    cierrePermitido: boolean;
  }> => {
    const cuentas = await ctx.runQuery(internal.adminAuth.estadoCuentas, {});
    return {
      contrasenaConfigurada: Boolean(process.env.RESET_PASSWORD),
      // true solo si la variable NO existe: una cadena vacía sigue siendo una
      // variable definida, no equivale a haberla eliminado.
      contrasenaEliminada: process.env.RESET_PASSWORD === undefined,
      // true si pasa la misma validación que el reset (longitud, sin BOM ni
      // saltos de línea ni caracteres invisibles). No expone el valor.
      contrasenaValida: passwordProblem(process.env.RESET_PASSWORD) === null,
      configuracionAlineada: cuentas.alineada,
      registrosSinResolver: cuentas.registrosSinResolver,
      resetEnCurso: cuentas.resetEnCurso,
      // El incidente solo se cierra con la variable ELIMINADA, además de la
      // configuración alineada, 0 registros sin resolver y ningún reset vivo.
      cierrePermitido:
        process.env.RESET_PASSWORD === undefined &&
        cuentas.alineada &&
        cuentas.registrosSinResolver === 0 &&
        cuentas.resetEnCurso === false,
    };
  },
});
