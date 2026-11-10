import { invalidateSessions, modifyAccountCredentials } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { normalizeEmail, runReset, type ResetResult } from "./lib/passwordReset";

// ARC-75 — Restablecer la contraseña de una de las 3 cuentas fijas. Todo es
// `internal*`: no se puede llamar desde la app, solo con `npx convex run`
// (acceso administrativo a Convex). Procedimiento seguro en el README
// (sección Autenticación): la nueva contraseña va en la variable de entorno
// RESET_PASSWORD, cargada sin escribirla en la línea de comandos, y se borra
// al terminar. Nunca es un argumento.
//
// Qué garantiza y qué no: tras el reset, la contraseña antigua deja de valer y se
// borran las sesiones y los refresh tokens de la cuenta, así que no se pueden
// abrir ni renovar sesiones con la credencial anterior. NO revoca de forma
// inmediata una pestaña ya autenticada: su JWT de acceso sigue valiendo hasta
// caducar (1 hora por defecto en @convex-dev/auth 0.0.94; auth.ts no la cambia).
//
// La lógica y el orden de los pasos están en lib/passwordReset.ts.

const EXECUTOR = "acceso administrativo Convex (CLI)";

// Cuentas permitidas: las 3 fijas (las mismas variables que usa seed.ts). Sin
// emails en el código.
function allowedEmails() {
  return [
    process.env.SEED_MIRIAM_EMAIL,
    process.env.SEED_MONICA_EMAIL,
    process.env.SEED_ANTONIO_EMAIL,
  ]
    .filter((email): email is string => Boolean(email))
    .map(normalizeEmail);
}

// Solo devuelve el id: nunca el documento (lleva el hash del secreto).
export const findPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", args.email),
      )
      .unique();
    return account?.userId ?? null;
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

// Todos los campos obligatorios llevan valor inicial; el resto es opcional a
// propósito y solo se rellena al cerrar.
export const openAudit = internalMutation({
  args: { requestId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.insert("passwordResetAudit", {
      requestId: args.requestId,
      userId: args.userId,
      startedAt: Date.now(),
      status: "iniciado",
      executor: EXECUTOR,
      sessionsInvalidated: 0,
    });
  },
});

// El estado de destino no puede ser `inconcluso_supersedido` (solo lo escribe
// `supersederPrevios`) ni ningún valor de «reparado»: no existe.
export const updateAudit = internalMutation({
  args: {
    requestId: v.string(),
    status: v.union(
      v.literal("fallo_cambio"),
      v.literal("contrasena_cambiada"),
      v.literal("completado"),
      v.literal("fallo_invalidacion"),
    ),
    finishedAt: v.optional(v.number()),
    sessionsInvalidated: v.optional(v.number()),
    sessionsRemaining: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { requestId, ...patch } = args;
    const record = await ctx.db
      .query("passwordResetAudit")
      .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
      .unique();
    if (record === null) throw new Error("No existe ese registro de auditoría");
    await ctx.db.patch(record._id, patch);
  },
});

const UNRESOLVED = ["iniciado", "fallo_cambio", "contrasena_cambiada", "fallo_invalidacion"];

// Marca los registros previos sin resolver del MISMO usuario como inconclusos,
// con referencia al reset completado que los sustituye. Solo con un `requestId`
// en `completado`; excluye el propio registro y los posteriores a él; idempotente
// (solo actúa sobre los que siguen sin resolver). No afirma que hubiera o no
// cambio de contraseña en los previos.
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
        previo._creationTime >= record._creationTime ||
        !UNRESOLVED.includes(previo.status)
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

// Permite comprobar que RESET_PASSWORD se borró sin enumerar variables ni leer
// su valor: devuelve solo un booleano.
export const estadoRestablecimiento = internalAction({
  args: {},
  handler: async () => ({ contrasenaConfigurada: Boolean(process.env.RESET_PASSWORD) }),
});
