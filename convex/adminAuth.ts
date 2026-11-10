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
  esPrevio,
  normalizeEmail,
  runReset,
  UNRESOLVED_STATUSES,
  type ResetResult,
} from "./lib/passwordReset";

// ARC-75 — Restablecer la contraseña de una de las 3 cuentas fijas. Todo es
// `internal*`: no se puede llamar desde la app, solo con `npx convex run`
// (acceso administrativo a Convex). Procedimiento seguro en el README
// (sección Autenticación): la nueva contraseña va en la variable de entorno
// RESET_PASSWORD, cargada sin escribirla en la línea de comandos, y se borra
// al terminar (solo tras un resultado A). Nunca es un argumento.
//
// Qué garantiza y qué no: tras el reset, la contraseña antigua deja de valer y se
// borran las sesiones y los refresh tokens de la cuenta, así que no se pueden
// abrir ni renovar sesiones con la credencial anterior. NO revoca de forma
// inmediata una pestaña ya autenticada: su JWT de acceso sigue valiendo hasta
// caducar (1 hora por defecto en @convex-dev/auth 0.0.94; auth.ts no la cambia).
//
// La lógica y el orden de los pasos están en lib/passwordReset.ts.

const EXECUTOR = "acceso administrativo Convex (CLI)";

// Las 3 cuentas permitidas, por el nombre de su variable (las mismas que usa
// seed.ts). Sin emails en el código.
const ACCOUNT_NAMES = ["MIRIAM", "MONICA", "ANTONIO"] as const;

function allowedEmails() {
  return ACCOUNT_NAMES.map((name) => process.env[`SEED_${name}_EMAIL`])
    .filter((email): email is string => Boolean(email))
    .map(normalizeEmail);
}

// Búsqueda ÚNICA de la cuenta: provider "password" y providerAccountId igual al
// email normalizado. La usan `findPasswordAccount` y `diagnosticoCuentas`, así que
// una cuenta de otro provider con el mismo id no cuenta en ninguna. Devuelve solo
// el id: nunca el documento (lleva el hash del secreto).
async function buscarCuentaPassword(ctx: QueryCtx, email: string) {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "password").eq("providerAccountId", email),
    )
    .unique();
  return account?.userId ?? null;
}

export const findPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => buscarCuentaPassword(ctx, normalizeEmail(args.email)),
});

// Solo lectura. Antes de un reset, comprueba que las tres variables SEED_*_EMAIL
// están alineadas con cuentas reales (si no, `resetPassword` falla cerrada). Solo
// devuelve el nombre de cada variable y booleanos: nunca emails ni hashes.
export const diagnosticoCuentas = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cuentas = [];
    for (const nombre of ACCOUNT_NAMES) {
      const raw = process.env[`SEED_${nombre}_EMAIL`];
      const variableConfigurada = Boolean(raw);
      const cuentaEncontrada =
        variableConfigurada && (await buscarCuentaPassword(ctx, normalizeEmail(raw!))) !== null;
      cuentas.push({ nombre, variableConfigurada, cuentaEncontrada });
    }
    return { cuentas, todasAlineadas: cuentas.every((c) => c.cuentaEncontrada) };
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

// Los obligatorios llevan valor al insertar; `sessionsAbsentAfterCheck` y el resto
// de opcionales NO se inicializan: ausente = no se verificó.
export const openAudit = internalMutation({
  args: { requestId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.insert("passwordResetAudit", {
      requestId: args.requestId,
      userId: args.userId,
      startedAt: Date.now(),
      status: "iniciado",
      executor: EXECUTOR,
    });
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
// (`esPrevio`: creados ANTES); idempotente (solo actúa sobre los que siguen sin
// resolver). Es el único camino que mueve registros terminales a
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
    let superseded = 0;
    for (const previo of previos) {
      if (
        previo._id === record._id ||
        !esPrevio(previo, record) ||
        !UNRESOLVED_STATUSES.includes(previo.status)
      ) {
        continue;
      }
      await ctx.db.patch(previo._id, {
        status: "inconcluso_supersedido",
        supersededBy: record.requestId,
      });
      superseded++;
    }
    return superseded;
  },
});

// Registros sin resolver (y no supersedidos) de las cuentas permitidas. Consulta
// el índice `by_userId` por usuario: no escanea la tabla completa.
export const contarSinResolver = internalQuery({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, args) => {
    let total = 0;
    for (const email of new Set(args.emails.map(normalizeEmail))) {
      const userId = await buscarCuentaPassword(ctx, email);
      if (userId === null) continue;
      const records = await ctx.db
        .query("passwordResetAudit")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      total += records.filter((r) => UNRESOLVED_STATUSES.includes(r.status)).length;
    }
    return total;
  },
});

export const resetPassword = internalAction({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<ResetResult> =>
    runReset(
      {
        allowedEmails,
        readPassword: () => process.env.RESET_PASSWORD,
        findUserId: (email) => ctx.runQuery(internal.adminAuth.findPasswordAccount, { email }),
        newRequestId: () => crypto.randomUUID(),
        openAudit: (requestId, userId) =>
          ctx.runMutation(internal.adminAuth.openAudit, {
            requestId,
            userId: userId as Id<"users">,
          }),
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
      args.email,
    ),
});

// Permite comprobar que RESET_PASSWORD se borró sin enumerar variables ni leer su
// valor, y cuántos registros siguen sin resolver. El incidente solo se da por
// cerrado con resultado A y `registrosSinResolver` en 0.
export const estadoRestablecimiento = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ contrasenaConfigurada: boolean; registrosSinResolver: number }> => ({
    contrasenaConfigurada: Boolean(process.env.RESET_PASSWORD),
    registrosSinResolver: await ctx.runQuery(internal.adminAuth.contarSinResolver, {
      emails: allowedEmails(),
    }),
  }),
});
