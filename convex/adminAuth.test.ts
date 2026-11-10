// Pruebas de integración de ARC-75 con convex-test: el cambio real del hash con
// `modifyAccountCredentials`, el borrado de sesiones y refresh tokens, la lista
// cerrada de cuentas, el diagnóstico de alineación, las transiciones de la
// auditoría y la supersesión del historial.
//
// Qué NO cubren: que un JWT ya emitido siga valiendo hasta caducar. `withIdentity`
// simula una identidad, no valida JWT reales ni su caducidad, así que no
// demostraría nada; esa propiedad se verifica por inspección de @convex-dev/auth
// (tokens.js: 1 h por defecto) y se observa en dev (ver README).
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { type ResetDeps, runReset } from "./lib/passwordReset";
import schema from "./schema";
import { modules } from "./test.setup";

const MIRIAM = "miriam@arco.test";
const MONICA = "monica@arco.test";
const ANTONIO = "antonio@arco.test";
const OTRA = "intrusa@arco.test";
const OLD_PASSWORD = "contrasena-antigua-1";
const NEW_PASSWORD = "contrasena-nueva-2";

beforeEach(() => {
  vi.stubEnv("SEED_MIRIAM_EMAIL", MIRIAM);
  vi.stubEnv("SEED_MONICA_EMAIL", MONICA);
  vi.stubEnv("SEED_ANTONIO_EMAIL", ANTONIO);
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

const auditOf = (t: T, requestId: string) =>
  t.run(async (ctx) =>
    ctx.db
      .query("passwordResetAudit")
      .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
      .unique(),
  );

type Status =
  | "iniciado"
  | "fallo_preparacion"
  | "contrasena_cambiada"
  | "cambio_no_confirmado"
  | "completado"
  | "fallo_invalidacion"
  | "inconcluso_supersedido";

async function seedAudit(t: T, userId: Id<"users">, requestId: string, status: Status) {
  await t.run((ctx) =>
    ctx.db.insert("passwordResetAudit", {
      requestId,
      userId,
      startedAt: 1,
      status,
      executor: "test",
    }),
  );
}

async function setup() {
  const t = newTest();
  await createAccount(t, MIRIAM, "Miriam", OLD_PASSWORD);
  await createAccount(t, MONICA, "Mónica", "clave-de-monica-1");
  return t;
}

// Dependencias reales (base de datos de convex-test) con las operaciones de auth
// sustituibles: sirve para forzar fallos y leer después el documento persistido.
function realDeps(t: T, overrides: Partial<ResetDeps> = {}): ResetDeps {
  return {
    allowedEmails: () => [MIRIAM, MONICA, ANTONIO],
    readPassword: () => NEW_PASSWORD,
    findUserId: (email) => t.query(internal.adminAuth.findPasswordAccount, { email }),
    newRequestId: () => crypto.randomUUID(),
    openAudit: (requestId, userId) =>
      t.mutation(internal.adminAuth.openAudit, { requestId, userId: userId as Id<"users"> }),
    updateAudit: (requestId, patch) =>
      t.mutation(internal.adminAuth.updateAudit, { requestId, ...patch }),
    sessionState: (userId, knownSessionIds) =>
      t.query(internal.adminAuth.sessionState, {
        userId: userId as Id<"users">,
        knownSessionIds,
      }),
    modifyPassword: async () => {},
    invalidateSessions: async () => {},
    superseder: (requestId) => t.mutation(internal.adminAuth.supersederPrevios, { requestId }),
    now: () => Date.now(),
    log: () => {},
    ...overrides,
  };
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
    await expect(t.action(internal.adminAuth.resetPassword, { email: ANTONIO })).rejects.toThrow();
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

  test("registro completado: sessionsAbsentAfterCheck y sin sesiones restantes", async () => {
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
      sessionsAbsentAfterCheck: 2,
      sessionsRemaining: 0,
    });
    expect(audit[0]).not.toHaveProperty("sessionsInvalidated");
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

describe("documento de auditoría persistido (lo que queda en la base)", () => {
  test("openAudit inserta el registro sin sessionsAbsentAfterCheck, sessionsRemaining ni finishedAt", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await t.mutation(internal.adminAuth.openAudit, { requestId: "r", userId: miriam });
    const doc = await auditOf(t, "r");
    expect(doc).toMatchObject({ status: "iniciado", executor: expect.any(String) });
    for (const field of ["sessionsAbsentAfterCheck", "sessionsRemaining", "finishedAt", "supersededBy"]) {
      expect(doc).not.toHaveProperty(field);
    }
  });

  test("C: tras 3 intentos fallidos, el documento NO tiene sessionsAbsentAfterCheck (nunca 0) y sí sessionsRemaining", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    const fail = async () => {
      throw new Error("fallo permanente");
    };
    await expect(
      runReset(realDeps(t, { invalidateSessions: fail }), MIRIAM),
    ).rejects.toThrow("NO se han invalidado");
    const [doc] = await allAudit(t);
    expect(doc.status).toBe("fallo_invalidacion");
    expect(doc).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(doc.sessionsRemaining).toBe(2);
  });

  test("D2: cambio no confirmado y sin invalidar → el documento no tiene sessionsAbsentAfterCheck", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    const fail = async () => {
      throw new Error("fallo");
    };
    await expect(
      runReset(realDeps(t, { modifyPassword: fail, invalidateSessions: fail }), MIRIAM),
    ).rejects.toThrow("CRÍTICO");
    const [doc] = await allAudit(t);
    expect(doc.status).toBe("cambio_no_confirmado");
    expect(doc).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(doc.sessionsRemaining).toBe(2);
  });

  test("D1: modifyPassword aplica el cambio y luego lanza → sesiones a 0 en la base y registro con verificación a cero", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const ids = [await addSession(t, miriam), await addSession(t, miriam)];
    const real = realDeps(t);
    const applyThenThrow = async (email: string, password: string) => {
      // El cambio se confirma en la base y el llamador solo ve un error.
      await t.mutation(internal.auth.store, {
        args: { type: "modifyAccount", provider: "password", account: { id: email, secret: password } },
      });
      throw new Error("error de transporte");
    };
    await expect(
      runReset(
        {
          ...real,
          modifyPassword: applyThenThrow,
          invalidateSessions: async (userId) => {
            await t.mutation(internal.auth.store, {
              args: { type: "invalidateSessions", userId: userId as Id<"users"> },
            });
          },
        },
        MIRIAM,
      ),
    ).rejects.toThrow("NO CONFIRMADO");
    expect(await counts(t, miriam, ids)).toEqual({ sessions: 0, refreshTokens: 0 });
    const [doc] = await allAudit(t);
    expect(doc).toMatchObject({
      status: "cambio_no_confirmado",
      sessionsAbsentAfterCheck: 2,
      sessionsRemaining: 0,
    });
    // `fallo_cambio` ya no existe: ni como estado guardado ni como destino de updateAudit.
    expect(doc.status as string).not.toBe("fallo_cambio");
    await expect(
      t.mutation(internal.adminAuth.updateAudit, {
        requestId: doc.requestId,
        // @ts-expect-error: estado eliminado, no permitido
        status: "fallo_cambio",
      }),
    ).rejects.toThrow();
  });

  test("fallo_preparacion: la lectura previa falla → no se llama a modify ni a invalidate y el registro queda cerrado", async () => {
    const t = await setup();
    const calls: string[] = [];
    await expect(
      runReset(
        realDeps(t, {
          sessionState: async () => {
            throw new Error("consulta caída");
          },
          modifyPassword: async () => {
            calls.push("modify");
          },
          invalidateSessions: async () => {
            calls.push("invalidate");
          },
        }),
        MIRIAM,
      ),
    ).rejects.toThrow("No se intentó cambiar la contraseña");
    expect(calls).toEqual([]);
    const [doc] = await allAudit(t);
    expect(doc.status).toBe("fallo_preparacion");
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
  });
});

describe("updateAudit: transiciones aplicadas en la base", () => {
  test("transiciones válidas se aceptan", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "a", "iniciado");
    await seedAudit(t, miriam, "b", "contrasena_cambiada");
    await t.mutation(internal.adminAuth.updateAudit, { requestId: "a", status: "contrasena_cambiada" });
    await t.mutation(internal.adminAuth.updateAudit, { requestId: "a", status: "completado" });
    await t.mutation(internal.adminAuth.updateAudit, { requestId: "b", status: "fallo_invalidacion" });
    expect(await auditOf(t, "a")).toMatchObject({ status: "completado" });
    expect(await auditOf(t, "b")).toMatchObject({ status: "fallo_invalidacion" });
  });

  test("cada estado terminal es inmutable: rechaza cualquier actualización y no cambia", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const terminales: Status[] = [
      "completado",
      "fallo_preparacion",
      "cambio_no_confirmado",
      "fallo_invalidacion",
      "inconcluso_supersedido",
    ];
    for (const status of terminales) await seedAudit(t, miriam, `t-${status}`, status);
    for (const status of terminales) {
      for (const destino of ["completado", "fallo_invalidacion", "contrasena_cambiada"] as const) {
        await expect(
          t.mutation(internal.adminAuth.updateAudit, {
            requestId: `t-${status}`,
            status: destino,
            sessionsRemaining: 99,
          }),
        ).rejects.toThrow();
      }
      const doc = await auditOf(t, `t-${status}`);
      expect(doc?.status).toBe(status);
      expect(doc).not.toHaveProperty("sessionsRemaining");
    }
  });

  test("transiciones inválidas, mismo estado, destino no permitido e inexistente → rechazadas", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "cc", "contrasena_cambiada");
    await seedAudit(t, miriam, "ini", "iniciado");
    await expect(
      t.mutation(internal.adminAuth.updateAudit, { requestId: "cc", status: "cambio_no_confirmado" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(internal.adminAuth.updateAudit, { requestId: "cc", status: "contrasena_cambiada" }),
    ).rejects.toThrow();
    for (const status of ["inconcluso_supersedido", "auditoria_reparada", "reparado", "fallo_cambio"]) {
      await expect(
        t.mutation(internal.adminAuth.updateAudit, {
          requestId: "ini",
          // @ts-expect-error: estados no permitidos a propósito
          status,
        }),
      ).rejects.toThrow();
    }
    await expect(
      t.mutation(internal.adminAuth.updateAudit, { requestId: "no-existe", status: "completado" }),
    ).rejects.toThrow();
    expect(await auditOf(t, "cc")).toMatchObject({ status: "contrasena_cambiada" });
    expect(await auditOf(t, "ini")).toMatchObject({ status: "iniciado" });
  });
});

describe("diagnosticoCuentas (solo lectura)", () => {
  async function diagnostico(t: T) {
    return t.query(internal.adminAuth.diagnosticoCuentas, {});
  }

  test("todo alineado → todasAlineadas true y sin emails en la salida", async () => {
    const t = await setup();
    await createAccount(t, ANTONIO, "Antonio", "clave-antonio-1");
    const result = await diagnostico(t);
    expect(result.todasAlineadas).toBe(true);
    expect(result.cuentas.map((c) => c.nombre)).toEqual(["MIRIAM", "MONICA", "ANTONIO"]);
    const serial = JSON.stringify(result);
    for (const email of [MIRIAM, MONICA, ANTONIO]) expect(serial).not.toContain(email);
  });

  test("cuenta ausente → false para esa cuenta y en total", async () => {
    const t = await setup(); // sin la cuenta de Antonio
    const result = await diagnostico(t);
    expect(result.todasAlineadas).toBe(false);
    expect(result.cuentas.find((c) => c.nombre === "ANTONIO")).toMatchObject({
      variableConfigurada: true,
      cuentaEncontrada: false,
    });
  });

  test("variable ausente → false", async () => {
    const t = await setup();
    await createAccount(t, ANTONIO, "Antonio", "clave-antonio-1");
    vi.stubEnv("SEED_ANTONIO_EMAIL", "");
    const result = await diagnostico(t);
    expect(result.todasAlineadas).toBe(false);
    expect(result.cuentas.find((c) => c.nombre === "ANTONIO")).toMatchObject({
      variableConfigurada: false,
      cuentaEncontrada: false,
    });
  });

  test("una cuenta de OTRO provider con el mismo id no cuenta como alineada", async () => {
    const t = await setup();
    // Existe el usuario de Antonio, pero su cuenta es de otro provider (no «password»).
    const antonio = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Antonio", email: ANTONIO, role: "agent" }),
    );
    await t.run((ctx) =>
      ctx.db.insert("authAccounts", {
        userId: antonio,
        provider: "github",
        providerAccountId: ANTONIO,
      }),
    );
    const result = await diagnostico(t);
    expect(result.todasAlineadas).toBe(false);
    expect(result.cuentas.find((c) => c.nombre === "ANTONIO")?.cuentaEncontrada).toBe(false);
    // resetPassword usa la misma búsqueda: también falla cerrada.
    await expect(t.action(internal.adminAuth.resetPassword, { email: ANTONIO })).rejects.toThrow();
  });

  test("no cambia la base de datos", async () => {
    const t = await setup();
    const snapshot = () =>
      t.run(async (ctx) => JSON.stringify([
        await ctx.db.query("users").collect(),
        await ctx.db.query("authAccounts").collect(),
        await ctx.db.query("passwordResetAudit").collect(),
      ]));
    const before = await snapshot();
    await diagnostico(t);
    expect(await snapshot()).toBe(before);
  });
});

describe("estadoRestablecimiento", () => {
  test("contrasenaConfigurada según la variable; sin registros → 0", async () => {
    const t = await setup();
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: true,
      registrosSinResolver: 0,
    });
    vi.stubEnv("RESET_PASSWORD", "");
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: false,
      registrosSinResolver: 0,
    });
  });

  test("registrosSinResolver cuenta solo los sin resolver de las cuentas permitidas", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const monica = await userIdOf(t, MONICA);
    await createAccount(t, OTRA, "Intrusa", "clave-intrusa-1");
    const otra = await userIdOf(t, OTRA);
    for (const [id, status] of [
      ["1", "iniciado"],
      ["2", "contrasena_cambiada"],
      ["3", "cambio_no_confirmado"],
      ["4", "fallo_invalidacion"],
    ] as const) {
      await seedAudit(t, miriam, `m${id}`, status);
    }
    // No cuentan: resueltos, supersedidos o de un usuario fuera de la lista.
    await seedAudit(t, miriam, "ok", "completado");
    await seedAudit(t, miriam, "prep", "fallo_preparacion");
    await seedAudit(t, monica, "sup", "inconcluso_supersedido");
    await seedAudit(t, otra, "ajeno", "iniciado");
    const status = await t.action(internal.adminAuth.estadoRestablecimiento, {});
    expect(status.registrosSinResolver).toBe(4);
    expect(JSON.stringify(status)).not.toContain(MIRIAM);
  });
});

describe("supersederPrevios", () => {
  test("previo inconcluso + nuevo reset completado → previo supersedido con el requestId correcto", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo-iniciado", "iniciado");
    await seedAudit(t, miriam, "previo-fallo", "fallo_invalidacion");
    await seedAudit(t, miriam, "previo-d", "cambio_no_confirmado");
    await seedAudit(t, miriam, "previo-cc", "contrasena_cambiada");
    await seedAudit(t, miriam, "nuevo", "completado");

    const n = await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });

    expect(n).toBe(4);
    for (const id of ["previo-iniciado", "previo-fallo", "previo-d", "previo-cc"]) {
      expect(await auditOf(t, id)).toMatchObject({
        status: "inconcluso_supersedido",
        supersededBy: "nuevo",
      });
    }
    // El propio registro nuevo no se toca.
    expect(await auditOf(t, "nuevo")).toMatchObject({ status: "completado" });
  });

  test("fallo_preparacion previo no se supersede (nada cambió con certeza)", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "prep", "fallo_preparacion");
    await seedAudit(t, miriam, "nuevo", "completado");
    expect(await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" })).toBe(0);
    expect(await auditOf(t, "prep")).toMatchObject({ status: "fallo_preparacion" });
  });

  test("rechaza un requestId que no está en completado o que no existe", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo", "fallo_invalidacion");
    await seedAudit(t, miriam, "en-curso", "iniciado");
    for (const requestId of ["en-curso", "no-existe"]) {
      await expect(t.mutation(internal.adminAuth.supersederPrevios, { requestId })).rejects.toThrow();
    }
    expect(await auditOf(t, "previo")).toMatchObject({ status: "fallo_invalidacion" });
    expect((await auditOf(t, "previo"))?.supersededBy).toBeUndefined();
  });

  test("no toca registros de otro usuario ni los completados", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const monica = await userIdOf(t, MONICA);
    await seedAudit(t, monica, "de-monica", "iniciado");
    await seedAudit(t, miriam, "ya-completado", "completado");
    await seedAudit(t, miriam, "nuevo", "completado");
    await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });
    expect(await auditOf(t, "de-monica")).toMatchObject({ status: "iniciado" });
    expect(await auditOf(t, "ya-completado")).toMatchObject({ status: "completado" });
  });

  test("no supersede registros posteriores al reset completado (p. ej. uno en curso)", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "nuevo", "completado");
    await seedAudit(t, miriam, "posterior-en-curso", "iniciado");
    await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });
    expect(await auditOf(t, "posterior-en-curso")).toMatchObject({ status: "iniciado" });
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
    await seedAudit(t, miriam, "previo-inconcluso", "cambio_no_confirmado");
    const result = (await t.action(internal.adminAuth.resetPassword, { email: MIRIAM })) as {
      requestId: string;
      registrosSupersedidos?: number;
    };
    expect(result.registrosSupersedidos).toBe(1);
    expect(await auditOf(t, "previo-inconcluso")).toMatchObject({
      status: "inconcluso_supersedido",
      supersededBy: result.requestId,
    });
  });

  test("un reset que falla después de abrir su auditoría NO supersede el previo (fallo_invalidacion se conserva)", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    await seedAudit(t, miriam, "previo", "fallo_invalidacion");
    const fail = async () => {
      throw new Error("fallo permanente");
    };
    await expect(
      runReset(realDeps(t, { invalidateSessions: fail }), MIRIAM),
    ).rejects.toThrow();
    expect(await auditOf(t, "previo")).toMatchObject({ status: "fallo_invalidacion" });
    expect((await auditOf(t, "previo"))?.supersededBy).toBeUndefined();
  });

  test("si la mutation de supersesión falla, los previos conservan su estado y el reset no se degrada", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo", "iniciado");
    const result = await runReset(
      realDeps(t, {
        superseder: async () => {
          throw new Error("fallo");
        },
      }),
      MIRIAM,
    );
    expect(result.historialPrevioPendiente).toBe(true);
    expect(await auditOf(t, "previo")).toMatchObject({ status: "iniciado" });
    const nuevo = await auditOf(t, result.requestId);
    expect(nuevo?.status).toBe("completado");
  });
});
