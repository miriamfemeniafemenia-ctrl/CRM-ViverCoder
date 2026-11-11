// Pruebas de integración de ARC-75 con convex-test: la envoltura `resetPassword`
// de extremo a extremo, el trabajo programado `ejecutarReset` con el cambio real
// del hash, la exclusión mutua por el estado REAL de la función programada
// (pending → inProgress → success/failed), la configuración estricta, la minimización
// de PII, las transiciones de la auditoría y la supersesión del historial.
//
// Qué NO cubren: que un JWT ya emitido siga valiendo hasta caducar. `withIdentity`
// simula una identidad, no valida JWT reales ni su caducidad, así que no
// demostraría nada; esa propiedad se verifica por inspección de @convex-dev/auth
// (tokens.js: 1 h por defecto) y se observa en dev (ver README).
import { convexTest } from "convex-test";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

// Control de `modifyAccountCredentials` e `invalidateSessions` (el resto de
// @convex-dev/auth pasa tal cual): permite mantener el trabajo VIVO (barrera) y
// forzar los fallos de la plataforma de auth.
const gate = vi.hoisted(() => ({
  hold: null as Promise<void> | null,
  modifyFails: false,
  modifyFailsAfterApply: false,
  invalidateFails: false,
  failMessage: "fallo simulado",
}));
vi.mock("@convex-dev/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/auth/server")>();
  return {
    ...actual,
    modifyAccountCredentials: async (
      ...args: Parameters<typeof actual.modifyAccountCredentials>
    ) => {
      if (gate.hold) await gate.hold;
      if (gate.modifyFails) throw new Error(gate.failMessage);
      await actual.modifyAccountCredentials(...args);
      if (gate.modifyFailsAfterApply) throw new Error(gate.failMessage);
    },
    invalidateSessions: async (...args: Parameters<typeof actual.invalidateSessions>) => {
      if (gate.invalidateFails) throw new Error("fallo permanente");
      return actual.invalidateSessions(...args);
    },
  };
});

// Crear cuentas (hash de contraseña) y ejecutar el trabajo programado es lento.
vi.setConfig({ testTimeout: 30_000 });

const MIRIAM = "miriam@arco.test";
const MONICA = "monica@arco.test";
const ANTONIO = "antonio@arco.test";
const OTRA = "intrusa@arco.test";
const EMAILS = [MIRIAM, MONICA, ANTONIO];
const OLD_PASSWORD = "contrasena-antigua-1";
const NEW_PASSWORD = "contrasena-nueva-2";

// Calentamiento con temporizadores REALES: la primera carga de los módulos (y del
// hash de contraseñas) bloquea si ocurre con el reloj simulado.
beforeAll(async () => {
  vi.stubEnv("SEED_MIRIAM_EMAIL", "calentar@arco.test");
  const t = newTest();
  await t.mutation(internal.auth.store, {
    args: {
      type: "createAccountFromCredentials",
      provider: "password",
      account: { id: "calentar@arco.test", secret: "clave-de-calentamiento" },
      profile: { name: "Calentar", email: "calentar@arco.test", role: "agent" },
    },
  });
  await t.query(internal.adminAuth.diagnosticoCuentas, {});
  await t.action(internal.adminAuth.estadoRestablecimiento, {});
  await t.mutation(internal.adminAuth.solicitarReset, { email: "calentar@arco.test" }).catch(() => {});
  vi.unstubAllEnvs();
});

beforeEach(() => {
  // convex-test solo admite funciones programadas con temporizadores simulados.
  vi.useFakeTimers();
  gate.hold = null;
  gate.modifyFails = false;
  gate.modifyFailsAfterApply = false;
  gate.invalidateFails = false;
  gate.failMessage = "fallo simulado";
  vi.stubEnv("SEED_MIRIAM_EMAIL", MIRIAM);
  vi.stubEnv("SEED_MONICA_EMAIL", MONICA);
  vi.stubEnv("SEED_ANTONIO_EMAIL", ANTONIO);
  vi.stubEnv("RESET_PASSWORD", NEW_PASSWORD);
});
afterEach(() => {
  vi.useRealTimers();
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
const allJobs = (t: T) => t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());

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

// Una función programada ya terminada (programada a una hora lejana y cancelada):
// su estado es `canceled`, es decir, NO está viva.
async function programadoTerminado(t: T) {
  return t.run(async (ctx) => {
    const id = await ctx.scheduler.runAfter(3_600_000, internal.adminAuth.supersederPrevios, {
      requestId: "x",
    });
    await ctx.scheduler.cancel(id);
    return id;
  });
}

async function seedAudit(
  t: T,
  userId: Id<"users">,
  requestId: string,
  status: Status,
  programadoId?: Id<"_scheduled_functions">,
) {
  const programado = programadoId ?? (await programadoTerminado(t));
  await t.run((ctx) =>
    ctx.db.insert("passwordResetAudit", {
      requestId,
      userId,
      startedAt: Date.now(),
      status,
      executor: "test",
      programadoId: programado,
    }),
  );
}

async function setup() {
  const t = newTest();
  await createAccount(t, MIRIAM, "Miriam", OLD_PASSWORD);
  await createAccount(t, MONICA, "Mónica", "clave-de-monica-1");
  await createAccount(t, ANTONIO, "Antonio", "clave-de-antonio-1");
  return t;
}

const terminada = (ejecucion: string) => ejecucion !== "pending" && ejecucion !== "inProgress";

// Avanza el reloj simulado (ejecutando las funciones programadas y las esperas de la
// envoltura) hasta que la ejecución cumpla la condición.
async function esperar(t: T, requestId: string, ok: (ejecucion: string) => boolean) {
  for (let i = 0; i < 400; i++) {
    const vista = await t.query(internal.adminAuth.resultadoReset, { requestId });
    if (ok(vista.ejecucion)) return vista;
    await vi.advanceTimersByTimeAsync(25);
  }
  throw new Error("Tiempo simulado agotado esperando a la ejecución");
}

// Ejecuta una promesa que depende de temporizadores simulados avanzando el reloj.
async function correr<R>(promesa: Promise<R>): Promise<R> {
  let fin = false;
  const envuelta = promesa.finally(() => {
    fin = true;
  });
  envuelta.catch(() => {});
  for (let i = 0; i < 400 && !fin; i++) await vi.advanceTimersByTimeAsync(250);
  return envuelta;
}

const solicitar = (t: T, email: string) =>
  t.mutation(internal.adminAuth.solicitarReset, { email });
const reset = (t: T, email: string) =>
  correr(t.action(internal.adminAuth.resetPassword, { email }));

// Barrera para mantener el trabajo vivo (dentro de `modifyAccountCredentials`).
function cerrarBarrera() {
  let abrir!: () => void;
  gate.hold = new Promise<void>((resolve) => {
    abrir = resolve;
  });
  return () => {
    gate.hold = null;
    abrir();
  };
}

async function nadaProgramado(t: T) {
  expect(await allJobs(t)).toHaveLength(0);
  expect(await allAudit(t)).toHaveLength(0);
}

describe("resetPassword (envoltura de extremo a extremo): cambio real de la contraseña", () => {
  test("A: la antigua deja de valer y la nueva entra; no se crean cuentas ni usuarios; registro completado", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    await addSession(t, miriam);
    const before = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).length,
      accounts: (await ctx.db.query("authAccounts").collect()).length,
    }));
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);

    const result = await reset(t, MIRIAM);

    expect(result).toMatchObject({ ok: true });
    expect(result).not.toHaveProperty("auditoriaPendiente");
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(false);
    const after = await t.run(async (ctx) => ({
      users: (await ctx.db.query("users").collect()).length,
      accounts: (await ctx.db.query("authAccounts").collect()).length,
    }));
    expect(after).toEqual(before);
    const [doc] = await allAudit(t);
    expect(doc).toMatchObject({
      requestId: result.requestId,
      userId: miriam,
      status: "completado",
      sessionsAbsentAfterCheck: 2,
      sessionsRemaining: 0,
    });
    expect(doc).not.toHaveProperty("sessionsInvalidated");
  });

  test("las demás cuentas no cambian; mayúsculas y espacios en el email", async () => {
    const t = await setup();
    await reset(t, `  ${MIRIAM.toUpperCase()} `);
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
    expect(await passwordWorks(t, MONICA, "clave-de-monica-1")).toBe(true);
    expect(await passwordWorks(t, MONICA, NEW_PASSWORD)).toBe(false);
  });

  test("las sesiones y refresh tokens del usuario desaparecen; los de otro usuario siguen", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const monica = await userIdOf(t, MONICA);
    const own = [await addSession(t, miriam), await addSession(t, miriam)];
    const other = [await addSession(t, monica)];
    await reset(t, MIRIAM);
    expect(await counts(t, miriam, own)).toEqual({ sessions: 0, refreshTokens: 0 });
    expect(await counts(t, monica, other)).toEqual({ sessions: 1, refreshTokens: 1 });
  });

  test("reejecutar es idempotente y se permite al instante: la nueva contraseña sigue valiendo y quedan 0 sesiones", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const ids = [await addSession(t, miriam)];
    await reset(t, MIRIAM);
    const extra = await addSession(t, miriam);
    await reset(t, MIRIAM);
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
    expect(await counts(t, miriam, [...ids, extra])).toEqual({ sessions: 0, refreshTokens: 0 });
    expect(await allAudit(t)).toHaveLength(2);
  });

  test("ni la contraseña, ni el hash, ni ningún email aparecen en el resultado, el registro ni la función programada", async () => {
    const t = await setup();
    const result = await reset(t, MIRIAM);
    const vista = await t.query(internal.adminAuth.resultadoReset, { requestId: result.requestId });
    const stored = JSON.stringify([result, vista, await allAudit(t), await allJobs(t)]);
    expect(stored).not.toContain(NEW_PASSWORD);
    expect(stored).not.toContain(OLD_PASSWORD);
    for (const email of EMAILS) expect(stored).not.toContain(email);
    const secret = await t.run(async (ctx) => (await ctx.db.query("authAccounts").first())?.secret);
    expect(secret && stored.includes(secret)).toBeFalsy();
  });
});

describe("rechazos previos: no programan nada, no abren auditoría, no tocan datos", () => {
  test("cuenta existente que no es de las tres, y cuenta inexistente", async () => {
    const t = await setup();
    await createAccount(t, OTRA, "Intrusa", "clave-intrusa-1");
    await expect(solicitar(t, OTRA)).rejects.toThrow("no está permitida");
    await expect(solicitar(t, "nadie@arco.test")).rejects.toThrow("no está permitida");
    expect(await passwordWorks(t, OTRA, "clave-intrusa-1")).toBe(true);
    await nadaProgramado(t);
  });

  test("RESET_PASSWORD ausente, corta o contaminada (BOM + CRLF de PowerShell 5.1) → error y la contraseña actual sigue valiendo", async () => {
    const t = await setup();
    for (const value of ["", "corta", `﻿${NEW_PASSWORD}\r\n`, `${NEW_PASSWORD}​`]) {
      vi.stubEnv("RESET_PASSWORD", value);
      await expect(reset(t, MIRIAM)).rejects.toThrow();
    }
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
    await nadaProgramado(t);
  });

  test("argumentos extra rechazados por el validador: no existe ningún bypass (previoTerminado u otro)", async () => {
    const t = await setup();
    await expect(
      t.action(internal.adminAuth.resetPassword, {
        email: MIRIAM,
        // @ts-expect-error: argumento no permitido a propósito
        previoTerminado: "cualquiera",
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(internal.adminAuth.solicitarReset, {
        email: MIRIAM,
        // @ts-expect-error: argumento no permitido a propósito
        forzar: true,
      }),
    ).rejects.toThrow();
    await nadaProgramado(t);
  });
});

describe("configuración estricta (falla cerrada)", () => {
  test("con SEED_MONICA_EMAIL ausente no se puede resetear NI a Miriam", async () => {
    const t = await setup();
    vi.stubEnv("SEED_MONICA_EMAIL", "");
    await expect(solicitar(t, MIRIAM)).rejects.toThrow("Configuración no alineada");
    await expect(reset(t, MIRIAM)).rejects.toThrow("Configuración no alineada");
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
    await nadaProgramado(t);
  });

  test("dos variables con el mismo email → falla cerrada", async () => {
    const t = await setup();
    vi.stubEnv("SEED_ANTONIO_EMAIL", MONICA);
    await expect(solicitar(t, MIRIAM)).rejects.toThrow("Configuración no alineada");
    await nadaProgramado(t);
  });

  test("una cuenta de OTRO provider con el mismo id no cuenta como alineada", async () => {
    const t = newTest();
    await createAccount(t, MIRIAM, "Miriam", OLD_PASSWORD);
    await createAccount(t, MONICA, "Mónica", "clave-de-monica-1");
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
    await expect(solicitar(t, MIRIAM)).rejects.toThrow("Configuración no alineada");
    expect((await t.query(internal.adminAuth.diagnosticoCuentas, {})).todasAlineadas).toBe(false);
    await nadaProgramado(t);
  });

  test("los TRES userId deben ser distintos: dos cuentas password con emails distintos pero el mismo userId → falla cerrada, no programa nada", async () => {
    const t = newTest();
    await createAccount(t, MIRIAM, "Miriam", OLD_PASSWORD);
    await createAccount(t, MONICA, "Mónica", "clave-de-monica-1");
    const miriam = await userIdOf(t, MIRIAM);
    // La «cuenta de Antonio» es otra cuenta password del MISMO usuario que Miriam.
    await t.run((ctx) =>
      ctx.db.insert("authAccounts", {
        userId: miriam,
        provider: "password",
        providerAccountId: ANTONIO,
        secret: "hash-ficticio",
      }),
    );
    await expect(solicitar(t, MIRIAM)).rejects.toThrow("Configuración no alineada");
    await expect(solicitar(t, ANTONIO)).rejects.toThrow("Configuración no alineada");
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
    const diag = await t.query(internal.adminAuth.diagnosticoCuentas, {});
    expect(diag.todasAlineadas).toBe(false);
    // Cada cuenta existe por separado, pero la configuración en conjunto no está alineada.
    expect(diag.cuentas.every((c) => c.cuentaEncontrada)).toBe(true);
    const estado = await t.action(internal.adminAuth.estadoRestablecimiento, {});
    expect(estado.configuracionAlineada).toBe(false);
    await nadaProgramado(t);
  });

  test("diagnosticoCuentas: todo alineado, cuenta ausente y variable ausente", async () => {
    const t = await setup();
    expect((await t.query(internal.adminAuth.diagnosticoCuentas, {})).todasAlineadas).toBe(true);
    vi.stubEnv("SEED_ANTONIO_EMAIL", "");
    const diag = await t.query(internal.adminAuth.diagnosticoCuentas, {});
    expect(diag.todasAlineadas).toBe(false);
    expect(diag.cuentas.find((c) => c.nombre === "ANTONIO")).toMatchObject({
      variableConfigurada: false,
      cuentaEncontrada: false,
    });
    vi.stubEnv("SEED_ANTONIO_EMAIL", "otro@arco.test"); // variable sin cuenta
    expect(
      (await t.query(internal.adminAuth.diagnosticoCuentas, {})).cuentas.find(
        (c) => c.nombre === "ANTONIO",
      ),
    ).toMatchObject({ variableConfigurada: true, cuentaEncontrada: false });
  });

  test("diagnosticoCuentas no cambia la base de datos", async () => {
    const t = await setup();
    const snapshot = () =>
      t.run(async (ctx) =>
        JSON.stringify([
          await ctx.db.query("users").collect(),
          await ctx.db.query("authAccounts").collect(),
          await ctx.db.query("passwordResetAudit").collect(),
        ]),
      );
    const before = await snapshot();
    await t.query(internal.adminAuth.diagnosticoCuentas, {});
    expect(await snapshot()).toBe(before);
  });
});

describe("exclusión mutua GLOBAL por el estado REAL de la función programada", () => {
  test("pending → inProgress (barrera) → success: mientras está viva se rechaza CUALQUIER otro reset; al terminar, se permite al instante", async () => {
    const t = await setup();
    const liberar = cerrarBarrera();
    const { requestId } = await solicitar(t, MIRIAM);

    // El trabajo arranca y se queda dentro de modifyAccountCredentials: inProgress REAL.
    const enVuelo = await esperar(t, requestId, (e) => e === "inProgress");
    expect(enVuelo.ejecucion).toBe("inProgress");
    expect(enVuelo.registro?.estado).toBe("iniciado");

    // Mismo usuario y OTRO usuario (RESET_PASSWORD es global): ambos se rechazan sin
    // crear otra función programada ni otro registro.
    await expect(solicitar(t, MIRIAM)).rejects.toThrow("sigue en curso");
    await expect(solicitar(t, ANTONIO)).rejects.toThrow("sigue en curso");
    await expect(solicitar(t, MONICA)).rejects.toThrow("sigue en curso");
    expect(await allJobs(t)).toHaveLength(1);
    expect(await allAudit(t)).toHaveLength(1);
    // Y el sistema lo reconoce como reset vivo; el cierre del incidente no está permitido.
    const estado = await t.action(internal.adminAuth.estadoRestablecimiento, {});
    expect(estado).toMatchObject({ resetEnCurso: true, cierrePermitido: false });

    // Se libera: success → el siguiente reset (de otro usuario) se permite al instante.
    liberar();
    const fin = await esperar(t, requestId, terminada);
    expect(fin.ejecucion).toBe("success");
    expect(fin.registro?.estado).toBe("completado");
    const otro = await solicitar(t, ANTONIO);
    await esperar(t, otro.requestId, terminada);
    expect(await passwordWorks(t, ANTONIO, NEW_PASSWORD)).toBe(true);
  });

  test("un reset TERMINADO con el registro SIN cerrar no bloquea (no hay espera de 35 min)", async () => {
    const t = await setup();
    const primero = await reset(t, MIRIAM);
    // Se simula que el cierre de auditoría falló: el registro quedó no terminal.
    await t.run(async (ctx) => {
      const doc = (await ctx.db.query("passwordResetAudit").collect())[0];
      await ctx.db.patch(doc._id, { status: "iniciado" });
    });
    expect(primero.ok).toBe(true);
    const estado = await t.action(internal.adminAuth.estadoRestablecimiento, {});
    // Sigue figurando como sin resolver (cierre no permitido) pero NO como reset vivo.
    expect(estado).toMatchObject({ resetEnCurso: false, registrosSinResolver: 1, cierrePermitido: false });
    const siguiente = await reset(t, MIRIAM);
    expect(siguiente.ok).toBe(true);
    // El A siguiente supersede el registro que quedó sin cerrar.
    const docs = await allAudit(t);
    expect(docs.map((d) => d.status).sort()).toEqual(["completado", "inconcluso_supersedido"]);
  });

  test("pending (temporizadores simulados): un segundo reset se rechaza hasta que el primero se ejecuta", async () => {
    vi.useFakeTimers();
    const t = await setup();
    const { requestId } = await solicitar(t, MIRIAM);
    expect((await t.query(internal.adminAuth.resultadoReset, { requestId })).ejecucion).toBe("pending");
    await expect(solicitar(t, ANTONIO)).rejects.toThrow("sigue en curso");
    expect(await allJobs(t)).toHaveLength(1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.query(internal.adminAuth.resultadoReset, { requestId })).ejecucion).toBe("success");
    await solicitar(t, ANTONIO);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  test("failed (D tras commit): la función programada acaba en failed y el siguiente reset se permite de inmediato", async () => {
    const t = await setup();
    gate.modifyFailsAfterApply = true;
    await expect(reset(t, MIRIAM)).rejects.toThrow("NO CONFIRMADO");
    const [doc] = await allAudit(t);
    const vista = await t.query(internal.adminAuth.resultadoReset, { requestId: doc.requestId });
    expect(vista.ejecucion).toBe("failed");
    gate.modifyFailsAfterApply = false;
    const siguiente = await reset(t, MIRIAM);
    expect(siguiente.ok).toBe(true);
    // El A supersede el cambio_no_confirmado anterior con el requestId correcto.
    expect((await auditOf(t, doc.requestId))?.status).toBe("inconcluso_supersedido");
    expect((await auditOf(t, doc.requestId))?.supersededBy).toBe(siguiente.requestId);
  });

  test("la envoltura que agota su espera no lanza otro reset: dice «sigue en curso» y el trabajo termina después", async () => {
    vi.stubEnv("RESET_ESPERA_MAX_MS", "400");
    const t = await setup();
    const liberar = cerrarBarrera();
    await expect(reset(t, MIRIAM)).rejects.toThrow("sigue en curso");
    expect(await allJobs(t)).toHaveLength(1);
    const [doc] = await allAudit(t);
    liberar();
    const fin = await esperar(t, doc.requestId, terminada);
    expect(fin.ejecucion).toBe("success");
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
  });
});

describe("minimización de PII: ningún email en argumentos programados ni en salidas", () => {
  test("los argumentos programados son EXCLUSIVAMENTE { requestId, userId }", async () => {
    vi.useFakeTimers();
    const t = await setup();
    const { requestId } = await solicitar(t, MIRIAM);
    const jobs = await allJobs(t);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].args).toHaveLength(1);
    expect(Object.keys(jobs[0].args[0] as object).sort()).toEqual(["requestId", "userId"]);
    expect((jobs[0].args[0] as { requestId: string }).requestId).toBe(requestId);
    const serial = JSON.stringify(jobs);
    for (const email of EMAILS) expect(serial).not.toContain(email);
    expect(serial).not.toContain(NEW_PASSWORD);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  test("cuentaDeUsuario devuelve solo el nombre de la variable, nunca el email", async () => {
    const t = await setup();
    const monica = await userIdOf(t, MONICA);
    expect(await t.query(internal.adminAuth.cuentaDeUsuario, { userId: monica })).toBe("MONICA");
    const serial = JSON.stringify(await t.query(internal.adminAuth.cuentaDeUsuario, { userId: monica }));
    for (const email of EMAILS) expect(serial).not.toContain(email);
  });

  test("ninguna función de consulta devuelve emails y resultadoReset nunca trae `error` ni texto de plataforma", async () => {
    const t = await setup();
    gate.failMessage = `fallo con ${MIRIAM} y ${NEW_PASSWORD}`;
    gate.modifyFails = true;
    let mensaje = "";
    try {
      await reset(t, MIRIAM);
    } catch (e) {
      mensaje = (e as Error).message;
    }
    const [doc] = await allAudit(t);
    const vista = await t.query(internal.adminAuth.resultadoReset, { requestId: doc.requestId });
    const salidas = JSON.stringify([
      mensaje,
      vista,
      await t.query(internal.adminAuth.diagnosticoCuentas, {}),
      await t.query(internal.adminAuth.estadoCuentas, {}),
      await t.action(internal.adminAuth.estadoRestablecimiento, {}),
      await allAudit(t),
    ]);
    for (const email of EMAILS) expect(salidas).not.toContain(email);
    expect(salidas).not.toContain(NEW_PASSWORD);
    expect(vista).not.toHaveProperty("error");
    expect(Object.keys(vista).sort()).toEqual(["ejecucion", "registro"]);
    expect(mensaje).toContain("NO CONFIRMADO");
  });
});

describe("fallos reales del trabajo programado (el operador recibe solo mensajes canónicos)", () => {
  test("D1: modifyPassword aplica el cambio y luego lanza → sesiones a 0, cambio_no_confirmado con verificación a cero, la nueva contraseña SÍ funciona", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const ids = [await addSession(t, miriam), await addSession(t, miriam)];
    gate.modifyFailsAfterApply = true;
    const error = await reset(t, MIRIAM).catch((e: Error) => e.message);
    expect(error).toContain("NO CONFIRMADO");
    expect(error).toContain("NO es un estado seguro");
    expect(error).toContain("REINTENTA AHORA");
    expect(await counts(t, miriam, ids)).toEqual({ sessions: 0, refreshTokens: 0 });
    const [doc] = await allAudit(t);
    expect(doc).toMatchObject({
      status: "cambio_no_confirmado",
      sessionsAbsentAfterCheck: 2,
      sessionsRemaining: 0,
    });
    expect(doc.status as string).not.toBe("fallo_cambio");
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
  });

  test("D sin cambio aplicado: la contraseña ANTERIOR sigue valiendo y el resultado es D, nunca A", async () => {
    const t = await setup();
    gate.modifyFails = true;
    const error = await reset(t, MIRIAM).catch((e: Error) => e.message);
    expect(error).toContain("puede seguir siendo válida");
    expect(error).toContain("pueden abrirse sesiones nuevas con ella");
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
    expect((await allAudit(t))[0].status).toBe("cambio_no_confirmado");
  });

  test("D2: cambio no confirmado e invalidación fallida → error crítico y el documento NO afirma sessionsAbsentAfterCheck", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    gate.modifyFails = true;
    gate.invalidateFails = true;
    const error = await reset(t, MIRIAM).catch((e: Error) => e.message);
    expect(error).toContain("CRÍTICO");
    const [doc] = await allAudit(t);
    expect(doc.status).toBe("cambio_no_confirmado");
    expect(doc).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(doc.sessionsRemaining).toBe(2);
  });

  test("C: cambio confirmado pero invalidación fallida → documento sin sessionsAbsentAfterCheck (nunca 0) y con sessionsRemaining", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    gate.invalidateFails = true;
    const error = await reset(t, MIRIAM).catch((e: Error) => e.message);
    expect(error).toContain("CONTRASEÑA CAMBIADA");
    expect(error).toContain("NO se han invalidado");
    const [doc] = await allAudit(t);
    expect(doc.status).toBe("fallo_invalidacion");
    expect(doc).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(doc.sessionsRemaining).toBe(2);
    expect(await passwordWorks(t, MIRIAM, NEW_PASSWORD)).toBe(true);
  });

  test("fallo_preparacion: RESET_PASSWORD se contamina entre la solicitud y la ejecución → no se toca nada", async () => {
    vi.useFakeTimers();
    const t = await setup();
    const { requestId } = await solicitar(t, MIRIAM);
    vi.stubEnv("RESET_PASSWORD", `﻿${NEW_PASSWORD}\r\n`);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const vista = await t.query(internal.adminAuth.resultadoReset, { requestId });
    expect(vista.ejecucion).toBe("failed");
    expect(vista.registro?.estado).toBe("fallo_preparacion");
    expect(await passwordWorks(t, MIRIAM, OLD_PASSWORD)).toBe(true);
  });
});

describe("estadoRestablecimiento", () => {
  test("todo alineado y sin registros: con RESET_PASSWORD presente NO se puede cerrar; solo con la variable ELIMINADA", async () => {
    const t = await setup();
    // Variable presente (cargada y válida): el incidente no puede darse por cerrado.
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: true,
      contrasenaEliminada: false,
      contrasenaValida: true,
      configuracionAlineada: true,
      registrosSinResolver: 0,
      resetEnCurso: false,
      cierrePermitido: false,
    });
    // Eliminada (no definida): ahora sí.
    vi.stubEnv("RESET_PASSWORD", undefined);
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: false,
      contrasenaEliminada: true,
      contrasenaValida: false,
      configuracionAlineada: true,
      registrosSinResolver: 0,
      resetEnCurso: false,
      cierrePermitido: true,
    });
  });

  test("una variable definida pero VACÍA no equivale a haberla eliminado: cierrePermitido sigue en false", async () => {
    const t = await setup();
    vi.stubEnv("RESET_PASSWORD", "");
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toMatchObject({
      contrasenaConfigurada: false, // vacía: no hay contraseña utilizable…
      contrasenaEliminada: false, // …pero la variable sigue definida
      cierrePermitido: false,
    });
  });

  test("tras un A con la variable todavía presente no se puede cerrar; al eliminarla, sí", async () => {
    const t = await setup();
    await reset(t, MIRIAM);
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toMatchObject({
      registrosSinResolver: 0,
      resetEnCurso: false,
      contrasenaEliminada: false,
      cierrePermitido: false,
    });
    vi.stubEnv("RESET_PASSWORD", undefined);
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toMatchObject({
      contrasenaEliminada: true,
      cierrePermitido: true,
    });
  });

  test("con la configuración NO alineada nunca da un 0 apto para cierre: nulls y cierrePermitido false, haya o no pendientes", async () => {
    const t = await setup();
    const monica = await userIdOf(t, MONICA);
    await seedAudit(t, monica, "pendiente-de-monica", "iniciado");
    vi.stubEnv("SEED_MONICA_EMAIL", ""); // se omite justo a la usuaria con el pendiente
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toEqual({
      contrasenaConfigurada: true,
      contrasenaEliminada: false,
      contrasenaValida: true,
      configuracionAlineada: false,
      registrosSinResolver: null,
      resetEnCurso: null,
      cierrePermitido: false,
    });
  });

  test("contraseña con BOM y CRLF: configurada pero NO válida, sin exponer el valor", async () => {
    const t = await setup();
    vi.stubEnv("RESET_PASSWORD", `﻿${NEW_PASSWORD}\r\n`);
    const estado = await t.action(internal.adminAuth.estadoRestablecimiento, {});
    expect(estado).toMatchObject({ contrasenaConfigurada: true, contrasenaValida: false });
    expect(JSON.stringify(estado)).not.toContain(NEW_PASSWORD);
  });

  test("registrosSinResolver cuenta solo los sin resolver de las TRES cuentas permitidas", async () => {
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
    const estado = await t.action(internal.adminAuth.estadoRestablecimiento, {});
    expect(estado.registrosSinResolver).toBe(4);
    expect(estado.cierrePermitido).toBe(false);
    for (const email of EMAILS) expect(JSON.stringify(estado)).not.toContain(email);
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

  test("no toca registros de otro usuario ni los completados, ni los posteriores", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    const monica = await userIdOf(t, MONICA);
    await seedAudit(t, monica, "de-monica", "iniciado");
    await seedAudit(t, miriam, "ya-completado", "completado");
    await seedAudit(t, miriam, "nuevo", "completado");
    await seedAudit(t, miriam, "posterior-en-curso", "iniciado");
    await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" });
    expect(await auditOf(t, "de-monica")).toMatchObject({ status: "iniciado" });
    expect(await auditOf(t, "ya-completado")).toMatchObject({ status: "completado" });
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

  test("defensa: NO supersede una ejecución que siga viva (función programada pending)", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    // Una función programada realmente pendiente (a una hora lejana).
    const viva = await t.run((ctx) =>
      ctx.scheduler.runAfter(3_600_000, internal.adminAuth.supersederPrevios, { requestId: "x" }),
    );
    await seedAudit(t, miriam, "previo-vivo", "iniciado", viva);
    await seedAudit(t, miriam, "nuevo", "completado");
    expect(await t.mutation(internal.adminAuth.supersederPrevios, { requestId: "nuevo" })).toBe(0);
    expect(await auditOf(t, "previo-vivo")).toMatchObject({ status: "iniciado" });
    await t.run((ctx) => ctx.scheduler.cancel(viva));
  });

  test("un reset que no llega a A NO supersede el previo (fallo_invalidacion se conserva)", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await addSession(t, miriam);
    await seedAudit(t, miriam, "previo", "fallo_invalidacion");
    gate.invalidateFails = true;
    await expect(reset(t, MIRIAM)).rejects.toThrow("NO se han invalidado");
    expect(await auditOf(t, "previo")).toMatchObject({ status: "fallo_invalidacion" });
    expect((await auditOf(t, "previo"))?.supersededBy).toBeUndefined();
  });

  test("un reset real que acaba en A supersede el historial previo sin resolver del usuario", async () => {
    const t = await setup();
    const miriam = await userIdOf(t, MIRIAM);
    await seedAudit(t, miriam, "previo-inconcluso", "cambio_no_confirmado");
    const result = await reset(t, MIRIAM);
    expect(await auditOf(t, "previo-inconcluso")).toMatchObject({
      status: "inconcluso_supersedido",
      supersededBy: result.requestId,
    });
    // No quedan registros sin resolver; con la variable eliminada se puede cerrar.
    vi.stubEnv("RESET_PASSWORD", undefined);
    expect(await t.action(internal.adminAuth.estadoRestablecimiento, {})).toMatchObject({
      registrosSinResolver: 0,
      cierrePermitido: true,
    });
  });
});
