// Pruebas de integración de ARC-75 con convex-test: el cambio real del hash con
// `modifyAccountCredentials`, el borrado de sesiones y refresh tokens, la lista
// cerrada de cuentas y la supersesión del historial de auditoría.
//
// Qué NO cubren: que un JWT ya emitido siga valiendo hasta caducar. `withIdentity`
// simula una identidad, no valida JWT reales ni su caducidad, así que no
// demostraría nada; esa propiedad se verifica por inspección de @convex-dev/auth
// (tokens.js: 1 h por defecto) y se observa en dev (ver README).
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const MIRIAM = "miriam@arco.test";
const MONICA = "monica@arco.test";
const OTRA = "intrusa@arco.test";
const OLD_PASSWORD = "contrasena-antigua-1";
const NEW_PASSWORD = "contrasena-nueva-2";

beforeEach(() => {
  vi.stubEnv("SEED_MIRIAM_EMAIL", MIRIAM);
  vi.stubEnv("SEED_MONICA_EMAIL", MONICA);
  vi.stubEnv("SEED_ANTONIO_EMAIL", "antonio@arco.test");
  vi.stubEnv("RESET_PASSWORD", NEW_PASSWORD);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const newTest = () => convexTest(schema, modules);
type T = ReturnType<typeof newTest>;

async function createAccount(t: T, email: string, name: string, secret: string) {
  await t.mutation(internal.auth.store, {
    args: {
      type: "createAccountFromCredentials",
      provider: "password",
      account: { id: email, secret },
      profile: { name, email, role: "agent" },
    },
  });
}

async function passwordWorks(t: T, email: string, secret: string) {
  const result = await t.mutation(internal.auth.store, {
    args: {
      type: "retrieveAccountWithCredentials",
      provider: "password",
      account: { id: email, secret },
    },
  });
  return typeof result === "object";
}

async function userIdOf(t: T, email: string) {
  return t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    return user!._id;
  });
}

// Una sesión con su refresh token, como los crea el login.
async function addSession(t: T, userId: Id<"users">) {
  return t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 1_000_000,
    });
    await ctx.db.insert("authRefreshTokens", {
      sessionId,
      expirationTime: Date.now() + 1_000_000,
    });
    return sessionId;
  });
}

const counts = (t: T, userId: Id<"users">, sessionIds: Id<"authSessions">[] = []) =>
  t.run(async (ctx) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    let refreshTokens = 0;
    for (const sessionId of sessionIds) {
      refreshTokens += (
        await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
          .collect()
      ).length;
    }
    return { sessions: sessions.length, refreshTokens };
  });

const allAudit = (t: T) => t.run((ctx) => ctx.db.query("passwordResetAudit").collect());

async function setup() {
  const t = newTest();
  await createAccount(t, MIRIAM, "Miriam", OLD_PASSWORD);
  await createAccount(t, MONICA, "Mónica", "clave-de-monica-1");
  return t;
}

describe("resetPassword: cambio real de la contraseña", () => {
  test("la antigua deja de valer y la nueva entra; no se crean cuentas ni usuarios", async () => {
    const t = await setup();
    const before = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).length,
      accounts: (await ctx.db.query("authAccounts").collect()).length,
    }));
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);

    const result = await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });

    expect(result).toMatchObject({ ok: true });
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(false);
    const after = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).length,
      accounts: (await ctx.db.query("authAccounts").collect()).length,
    }));
    expect(after).toEqual(before);
  });

  test("las demás cuentas no cambian", async () => {
    const t = await setup();
    await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });
    expect(await passwordWorks(t, MONICA, "clave-de-monica-1")).toBe(true);
    expect(await passwordWorks(t, MONICA, NEW_PASSWORD)).toBe(false);
  });

  test("mayúsculas y espacios en el email", async () => {
    const t = await setup();
    await t.action(internal.adminAuth.resetPassword, { email: `  ${MIRIAM.toUpperCase()} ` });
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
  });

  test("el resultado y el registro no contienen la contraseña, ni el hash, ni el email", async () => {
    const t = await setup();
    const result = await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });
    const stored = JSON.stringify([result, await allAudit(t)]);
    expect(stored).not.toContain(NEW_PASSWORD);
    expect(stored).not.toContain(OLD_PASSWORD);
    expect(stored).not.toContain(MIRIAM);
    const secret = await t.run(async (ctx) => (await ctx.db.query("authAccounts").first())?.secret);
    expect(secret && stored.includes(secret)).toBeFalsy();
  });
});

describe("resetPassword: cuentas y contraseña rechazadas (no cambian nada)", () => {
  test("cuenta existente que no es de las tres → error y nada cambia", async () => {
    const t = await setup();
    await createAccount(t, OTRA, "Intrusa", "clave-intrusa-1");
    await expect(t.action(internal.adminAuth.resetPassword, { email: OTRA })).rejects.toThrow();
    expect(await passwordWorks(t, OTRA, "clave-intrusa-1")).toBe(true);
    expect(await allAudit(t)).toHaveLength(0);
  });

  test("email inexistente → error, sin crear cuenta", async () => {
    const t = await setup();
    await expect(
      t.action(internal.adminAuth.resetPassword, { email: "antonio@arco.test" }),
    ).rejects.toThrow();
    const accounts = await t.run(async (ctx) => (await ctx.db.query("authAccounts").collect()).length);
    expect(accounts).toBe(2);
  });

  test("sin RESET_PASSWORD o demasiado corta → error y la contraseña actual sigue valiendo", async () => {
    const t = await setup();
    for (const value of ["", "corta"]) {
      vi.stubEnv("RESET_PASSWORD", value);
      await expect(t.action(internal.adminAuth.resetPassword, { email: MIRIAM })).rejects.toThrow();
    }
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
    expect(await allAudit(t)).toHaveLength(0);
  });
});

describe("resetPassword: sesiones y refresh tokens", () => {
  test("los del usuario desaparecen; los de otro usuario siguen", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const monica = await userIdOf(t, MONICA);
    const own = [await addSession(t, miriam), await addSession(t, miriam)];
    const other = [await addSession(t, monica)];

    await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });

    expect(await counts(t, miriam, own)).toEqual({ sessions: 0, refreshTokens: 0 });
    expect(await counts(t, monica, other)).toEqual({ sessions: 1, refreshTokens: 1 });
  });

  test("registro de auditoría completado: sin sesiones restantes y contadores coherentes", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    await addSession(t, miriam);
    const result = await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });
    const audit = await allAudit(t);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      requestId: (result as { requestId: string }).requestId,
      userId: miriam,
      status: "completado",
      sessionsInvalidated: 2,
      sessionsRemaining: 0,
    });
  });

  test("reejecutar es idempotente: la nueva contraseña sigue valiendo y quedan 0 sesiones", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const ids = [await addSession(t, miriam)];
    await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });
    const extra = await addSession(t, miriam);
    await t.action(internal.adminAuth.resetPassword, { email: MIRIAM });
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
    expect(await counts(t, miriam, [...ids, extra])).toEqual({ sessions: 0, refreshTokens: 0 });
    expect(await allAudit(t)).toHaveLength(2);
  });
});

describe("estadoRestablecimiento", () => {
  test("solo devuelve un booleano según la variable", async () => {
    const t = await setup();
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: true,
    });
    vi.stubEnv("RESET_PASSWORD", "");
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: false,
    });
  });
});

describe("supersederPrevios", () => {
  async function seedAudit(
    t: T,
    userId: Id<"users">,
    requestId: string,
    status: "iniciado" | "fallo_cambio" | "contrasena_cambiada" | "completado" | "fallo_invalidacion",
  ) {
    await t.run((ctx) =>
      ctx.db.insert("passwordResetAudit", {
        requestId,
        userId,
        startedAt: 1,
        status,
        executor: "test",
        sessionsInvalidated: 0,
      }),
    );
  }
  const statusOf = async (t: T, requestId: string) =>
    t.run(async (ctx) =>
      ctx.db
        .query("passwordResetAudit")
        .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
        .unique(),
    );

  test("previo inconcluso + nuevo reset completado → previo supersedido con el requestId correcto", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo-iniciado", "iniciado");
    await seedAudit(t, miriam, "previo-fallo", "fallo_invalidacion");
    await seedAudit(t, miriam, "nuevo", "completado");

    const n = await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });

    expect(n).toBe(2);
    expect(await statusOf(t, "previo-iniciado")).toMatchObject({
      status: "inconcluso_supersedido",
      supersededBy: "nuevo",
    });
    expect(await statusOf(t, "previo-fallo")).toMatchObject({
      status: "inconcluso_supersedido",
      supersededBy: "nuevo",
    });
    // El propio registro nuevo no se toca.
    expect(await statusOf(t, "nuevo")).toMatchObject({ status: "completado" });
  });

  test("rechaza un requestId que no está en completado o que no existe", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo", "fallo_invalidacion");
    await seedAudit(t, miriam, "en-curso", "iniciado");
    for (const requestId of ["en-curso", "no-existe"]) {
      await expect(t.mutation(internal.adminAuth.supersederPrevios, { requestId })).rejects.toThrow();
    }
    expect(await statusOf(t, "previo")).toMatchObject({ status: "fallo_invalidacion" });
    expect((await statusOf(t, "previo"))?.supersededBy).toBeUndefined();
  });

  test("no toca registros de otro usuario ni los completados", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const monica = await userIdOf(t, MONICA);
    await seedAudit(t, monica, "de-monica", "iniciado");
    await seedAudit(t, miriam, "ya-completado", "completado");
    await seedAudit(t, miriam, "nuevo", "completado");
    await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });
    expect(await statusOf(t, "de-monica")).toMatchObject({ status: "iniciado" });
    expect(await statusOf(t, "ya-completado")).toMatchObject({ status: "completado" });
  });

  test("no supersede registros posteriores al reset completado (p. ej. uno en curso)", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "nuevo", "completado");
    await seedAudit(t, miriam, "posterior-en-curso", "iniciado");
    await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });
    expect(await statusOf(t, "posterior-en-curso")).toMatchObject({ status: "iniciado" });
  });

  test("es idempotente: la segunda ejecución no cambia nada", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo", "iniciado");
    await seedAudit(t, miriam, "nuevo", "completado");
    expect(await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" })).toBe(1);
    expect(await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" })).toBe(0);
  });

  test("un reset real que acaba en A supersede el historial previo sin resolver del usuario", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo-inconcluso", "contrasena_cambiada");
    const result = (await t.action(internal.adminAuth.resetPassword, { email: MIRIAM })) as {
      requestId: string;
      registrosSupersedidos?: number;
    };
    expect(result.registrosSupersedidos).toBe(1);
    expect(await statusOf(t, "previo-inconcluso")).toMatchObject({
      status: "inconcluso_supersedido",
      supersededBy: result.requestId,
    });
  });

  test("updateAudit no puede escribir inconcluso_supersedido ni ningún estado de «reparado»", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "x", "iniciado");
    for (const status of ["inconcluso_supersedido", "auditoria_reparada", "reparado"]) {
      await expect(
        t.mutation(internal.adminAuth.updateAudit, {
          requestId: "x",
          // @ts-expect-error: estados no permitidos a propósito
          status,
        }),
      ).rejects.toThrow();
    }
    expect(await statusOf(t, "x")).toMatchObject({ status: "iniciado" });
  });
});
