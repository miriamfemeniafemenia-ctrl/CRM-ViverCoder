// Pruebas de la lógica pura del restablecimiento de contraseña (ARC-75): el
// trabajo `runReset` con dependencias simuladas (fallos parciales, orden de los
// pasos, resultados A/B/C/D1/D2), el guard de la contraseña, la regla de «ejecución
// viva» (estado de la función programada) y la clasificación de resultados.
import { describe, expect, test } from "vitest";
import {
  type AuditPatch,
  type ResetDeps,
  AUDIT_WRITE_ATTEMPTS,
  LEASE_MS,
  MAX_INVALIDATION_ATTEMPTS,
  canTransition,
  clasificarResultado,
  ejecucionViva,
  esPrevio,
  passwordProblem,
  registroBloquea,
  runReset,
} from "./passwordReset";

const EMAIL = "miriam@arco.test";
const PASSWORD = "clave-secreta-de-prueba";
const ARGS = { requestId: "req-1", userId: "user1" };

type Harness = ReturnType<typeof harness>;

function harness(overrides: Partial<ResetDeps> = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const patches: AuditPatch[] = [];
  // Estado simulado de la cuenta: contraseña cambiada y sesiones vivas.
  const state = { passwordChanged: false, sessions: 2 };
  const deps: ResetDeps = {
    readPassword: () => PASSWORD,
    resolveEmail: async () => EMAIL,
    updateAudit: async (_requestId, patch) => {
      calls.push(`updateAudit:${patch.status}`);
      patches.push(patch);
    },
    sessionState: async () => {
      calls.push("sessionState");
      return {
        sessionIds: state.sessions > 0 ? ["s1", "s2"] : [],
        sessions: state.sessions,
        refreshTokens: state.sessions,
      };
    },
    modifyPassword: async () => {
      calls.push("modifyPassword");
      state.passwordChanged = true;
    },
    invalidateSessions: async () => {
      calls.push("invalidateSessions");
      state.sessions = 0;
    },
    superseder: async () => {
      calls.push("superseder");
      return 1;
    },
    now: () => 1000,
    log: (m) => logs.push(m),
    ...overrides,
  };
  return { deps, calls, logs, patches, state };
}

const failing = (message = "fallo simulado") => async () => {
  throw new Error(message);
};

const rejection = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("Se esperaba un rechazo");
};

const finalPatch = (h: Harness) => h.patches.at(-1);
const finalStatus = (h: Harness) => finalPatch(h)?.status;

describe("passwordProblem (guard de RESET_PASSWORD)", () => {
  test("acepta contraseñas válidas: espacios intermedios, INICIALES y FINALES (significativos), símbolos y acentos", () => {
    for (const ok of [
      "abcdefgh",
      "con espacios dentro 1",
      "  espacios al principio",
      "espacios al final   ",
      "ñandú-€-ÁÉ-123",
      PASSWORD,
    ]) {
      expect(passwordProblem(ok)).toBeNull();
    }
  });

  test("rechaza ausente, corta y los caracteres Cc, Cf, Zl y Zp (BOM, CR/LF, invisibles, bidi, separadores de línea)", () => {
    expect(passwordProblem(undefined)).not.toBeNull();
    expect(passwordProblem("")).not.toBeNull();
    expect(passwordProblem("corta")).not.toBeNull();
    const malos = [
      "﻿", // BOM (Cf)
      "\r\n",
      "\n",
      "\t",
      "\u0000",
      "\u007F", // DEL
      "\u0085", // C1 (Cc)
      "​", // espacio de ancho cero (Cf)
      "‎", // marca izquierda-derecha (Cf)
      "‏",
      "⁠", // word joiner (Cf)
      "‮", // control bidi (Cf)
      " ", // separador de línea (Zl)
      " ", // separador de párrafo (Zp)
    ];
    for (const ch of malos) {
      for (const value of [`${PASSWORD}${ch}`, `${ch}${PASSWORD}`, `${PASSWORD.slice(0, 5)}${ch}${PASSWORD.slice(5)}`]) {
        const problem = passwordProblem(value);
        expect(problem, JSON.stringify(ch)).not.toBeNull();
        expect(problem).not.toContain(PASSWORD);
      }
    }
  });
});

describe("runReset: preparación (fallo_preparacion)", () => {
  test("RESET_PASSWORD deja de ser válida → fallo_preparacion y no se toca nada", async () => {
    for (const value of [undefined, "corta", `﻿${PASSWORD}\r\n`]) {
      const h = harness({ readPassword: () => value });
      const message = await rejection(runReset(h.deps, ARGS));
      expect(finalStatus(h)).toBe("fallo_preparacion");
      expect(h.calls).not.toContain("modifyPassword");
      expect(h.calls).not.toContain("invalidateSessions");
      expect(message).toContain("No se intentó cambiar la contraseña");
      expect(message).not.toContain(PASSWORD);
    }
  });

  test("no se puede resolver la cuenta → fallo_preparacion", async () => {
    const h = harness({ resolveEmail: failing("sin cuenta") });
    const message = await rejection(runReset(h.deps, ARGS));
    expect(finalStatus(h)).toBe("fallo_preparacion");
    expect(h.calls).not.toContain("modifyPassword");
    expect(message).toContain("No se intentó cambiar la contraseña");
  });

  test("la lectura previa de sesiones falla → fallo_preparacion, sin cambiar ni invalidar nada", async () => {
    const h = harness({ sessionState: failing("consulta caída") });
    const message = await rejection(runReset(h.deps, ARGS));
    expect(finalStatus(h)).toBe("fallo_preparacion");
    expect(h.calls).not.toContain("modifyPassword");
    expect(h.calls).not.toContain("invalidateSessions");
    expect(h.calls).not.toContain("superseder");
    expect(message).toContain("No se intentó cambiar la contraseña");
    expect(h.state.passwordChanged).toBe(false);
  });
});

describe("runReset: resultado A", () => {
  test("orden: cambio → invalidación → verificación → completado → supersesión", async () => {
    const h = harness();
    const result = await runReset(h.deps, ARGS);
    expect(result).toEqual({ ok: true, requestId: "req-1", registrosSupersedidos: 1 });
    expect(h.calls.indexOf("modifyPassword")).toBeLessThan(h.calls.indexOf("invalidateSessions"));
    expect(h.calls.indexOf("invalidateSessions")).toBeLessThan(
      h.calls.indexOf("updateAudit:completado"),
    );
    expect(h.calls.at(-1)).toBe("superseder");
    expect(finalPatch(h)).toMatchObject({
      status: "completado",
      sessionsRemaining: 0,
      sessionsAbsentAfterCheck: 2,
    });
    expect(finalPatch(h)).not.toHaveProperty("sessionsInvalidated");
  });

  test("la contraseña y el email no aparecen en logs, auditoría ni resultado", async () => {
    const h = harness();
    const result = await runReset(h.deps, ARGS);
    const todo = JSON.stringify([h.logs, h.patches, result]);
    expect(todo).not.toContain(PASSWORD);
    expect(todo).not.toContain(EMAIL);
  });

  test("una invalidación que falla una vez se reintenta y acaba en A", async () => {
    let n = 0;
    const h = harness();
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      if (++n === 1) throw new Error("fallo transitorio");
      h.state.sessions = 0;
    };
    const result = await runReset(h.deps, ARGS);
    expect(result.ok).toBe(true);
    expect(n).toBe(2);
    expect(finalStatus(h)).toBe("completado");
  });

  test("sesión creada entre la captura y la invalidación: el bucle la vuelve a invalidar", async () => {
    const h = harness();
    let invalidations = 0;
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      invalidations++;
      h.state.sessions = invalidations === 1 ? 1 : 0;
    };
    const result = await runReset(h.deps, ARGS);
    expect(result.ok).toBe(true);
    expect(invalidations).toBe(2);
  });
});

describe("runReset: escrituras de auditoría con reintentos", () => {
  test("una escritura de cierre que falla 2 veces y acierta a la 3.ª deja el registro completado (A, no B)", async () => {
    let fallos = 0;
    const h = harness();
    h.deps.updateAudit = async (_id, patch) => {
      h.calls.push(`updateAudit:${patch.status}`);
      if (patch.status === "completado" && fallos < AUDIT_WRITE_ATTEMPTS - 1) {
        fallos++;
        throw new Error("auditoría caída");
      }
      h.patches.push(patch);
    };
    const result = await runReset(h.deps, ARGS);
    expect(fallos).toBe(2);
    expect(result).toEqual({ ok: true, requestId: "req-1", registrosSupersedidos: 1 });
    expect(finalStatus(h)).toBe("completado");
  });

  test("si las 3 escrituras de cierre fallan → B (no supersede)", async () => {
    const h = harness();
    h.deps.updateAudit = async (_id, patch) => {
      h.calls.push(`updateAudit:${patch.status}`);
      if (patch.status === "completado") throw new Error("auditoría caída");
    };
    const result = await runReset(h.deps, ARGS);
    expect(result).toEqual({ ok: true, requestId: "req-1", auditoriaPendiente: true });
    expect(h.calls.filter((c) => c === "updateAudit:completado")).toHaveLength(AUDIT_WRITE_ATTEMPTS);
    expect(h.calls).not.toContain("superseder");
  });
});

describe("runReset: B (auditoría pendiente) y C (sesiones no invalidadas)", () => {
  test("si toda la auditoría falla tras cambiar la contraseña, la invalidación SIGUE y es resultado B", async () => {
    const h = harness({ updateAudit: failing("auditoría caída") });
    const result = await runReset(h.deps, ARGS);
    expect(h.calls).toContain("invalidateSessions");
    expect(result).toEqual({ ok: true, requestId: "req-1", auditoriaPendiente: true });
    expect(h.calls).not.toContain("superseder");
  });

  test("la invalidación falla siempre → C: lanza, fallo_invalidacion, solo sessionsRemaining, sin supersesión", async () => {
    const h = harness();
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      throw new Error("fallo permanente");
    };
    const message = await rejection(runReset(h.deps, ARGS));
    expect(message).toContain("CONTRASEÑA CAMBIADA");
    expect(message).toContain("NO se han invalidado");
    expect(finalStatus(h)).toBe("fallo_invalidacion");
    expect(finalPatch(h)).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(finalPatch(h)).toMatchObject({ sessionsRemaining: 4 });
    expect(h.calls.filter((c) => c === "invalidateSessions")).toHaveLength(
      MAX_INVALIDATION_ATTEMPTS,
    );
    expect(h.calls).not.toContain("superseder");
    expect(h.calls).not.toContain("updateAudit:completado");
  });

  test("no se puede verificar el recuento → C sin sessionsRemaining ni sessionsAbsentAfterCheck", async () => {
    const h = harness();
    let first = true;
    h.deps.sessionState = async () => {
      if (first) {
        first = false;
        return { sessionIds: ["s1"], sessions: 1, refreshTokens: 1 };
      }
      throw new Error("consulta caída");
    };
    const message = await rejection(runReset(h.deps, ARGS));
    expect(message).toContain("NO se han invalidado");
    expect(finalStatus(h)).toBe("fallo_invalidacion");
    expect(finalPatch(h)).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(finalPatch(h)).not.toHaveProperty("sessionsRemaining");
  });
});

describe("runReset: D (cambio no confirmado) — nunca éxito, nunca «seguro»", () => {
  test("modifyPassword APLICA el cambio y luego lanza: se invalida igualmente, sesiones a 0, D1, nunca fallo_cambio", async () => {
    const h = harness();
    h.deps.modifyPassword = async () => {
      h.calls.push("modifyPassword");
      h.state.passwordChanged = true; // el commit ocurrió…
      throw new Error("error de transporte"); // …pero el llamador solo ve el error
    };
    const message = await rejection(runReset(h.deps, ARGS));
    expect(h.calls).toContain("invalidateSessions");
    expect(h.state.sessions).toBe(0);
    expect(finalStatus(h)).toBe("cambio_no_confirmado");
    expect(finalPatch(h)).toMatchObject({ sessionsAbsentAfterCheck: 2, sessionsRemaining: 0 });
    expect(message).toContain("NO CONFIRMADO");
    expect(message).toContain("puede seguir siendo válida");
    expect(message).toContain("REINTENTA AHORA");
    expect(message).toContain("NO retires RESET_PASSWORD");
    expect(h.patches.map((p) => p.status as string)).not.toContain("fallo_cambio");
    expect(h.calls).not.toContain("updateAudit:contrasena_cambiada");
    expect(h.calls).not.toContain("superseder");
  });

  test("modifyPassword lanza SIN aplicar el cambio: mismo flujo, y un inicio con la contraseña antigua tras la verificación no se trata como seguro", async () => {
    const h = harness();
    h.deps.modifyPassword = failing("fallo antes del commit");
    const message = await rejection(runReset(h.deps, ARGS));
    expect(h.state.passwordChanged).toBe(false);
    expect(h.state.sessions).toBe(0);
    h.state.sessions = 1; // la contraseña anterior sigue valiendo: sesión nueva posterior
    expect(finalStatus(h)).toBe("cambio_no_confirmado");
    expect(message).toContain("NO es un estado seguro");
    expect(message).toContain("pueden abrirse sesiones nuevas con ella");
    expect(h.calls).not.toContain("updateAudit:completado");
  });

  test("D2: modifyPassword lanza Y la invalidación falla siempre → error crítico, solo sessionsRemaining, nunca éxito", async () => {
    const h = harness();
    h.deps.modifyPassword = failing();
    h.deps.invalidateSessions = failing("fallo permanente");
    const message = await rejection(runReset(h.deps, ARGS));
    expect(message).toContain("CRÍTICO");
    expect(message).toContain("NO invalidados");
    expect(message).toContain("REINTENTA AHORA");
    expect(finalStatus(h)).toBe("cambio_no_confirmado");
    expect(finalPatch(h)).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(finalPatch(h)).toMatchObject({ sessionsRemaining: 4 });
  });

  test("el mensaje de error no contiene la contraseña ni el email", async () => {
    const h = harness({ modifyPassword: failing(`clave ${PASSWORD} de ${EMAIL} inválida`) });
    const message = await rejection(runReset(h.deps, ARGS));
    expect(message).not.toContain(PASSWORD);
    expect(message).not.toContain(EMAIL);
    expect(JSON.stringify([h.logs, h.patches])).not.toContain(PASSWORD);
  });
});

describe("runReset: supersesión de registros previos", () => {
  test("si superseder falla tras un A, el reset no se degrada y se avisa", async () => {
    const h = harness({ superseder: failing("fallo") });
    const result = await runReset(h.deps, ARGS);
    expect(result).toEqual({ ok: true, requestId: "req-1", historialPrevioPendiente: true });
    expect(finalStatus(h)).toBe("completado");
  });

  test("un reset que no llega a A no supersede nada (D, C y fallo_preparacion)", async () => {
    for (const make of [
      () => harness({ modifyPassword: failing() }),
      () => harness({ invalidateSessions: failing() }),
      () => harness({ sessionState: failing() }),
    ]) {
      const h = make();
      await rejection(runReset(h.deps, ARGS));
      expect(h.calls).not.toContain("superseder");
    }
  });
});

describe("ejecución viva: el estado de la función programada decide el bloqueo", () => {
  const T0 = 1_000_000;

  test("pending e inProgress bloquean; success, failed y canceled liberan AL INSTANTE", () => {
    expect(ejecucionViva("pending", T0, T0 + 1000)).toBe(true);
    expect(ejecucionViva("inProgress", T0, T0 + 1000)).toBe(true);
    for (const estado of ["success", "failed", "canceled"] as const) {
      expect(ejecucionViva(estado, T0, T0 + 1000)).toBe(false);
    }
  });

  test("fila purgada (null): se trata como viva solo mientras sea reciente", () => {
    expect(ejecucionViva(null, T0, T0 + 60_000)).toBe(true);
    expect(ejecucionViva(null, T0, T0 + LEASE_MS)).toBe(false);
  });

  test("red de seguridad: pending/inProgress más antiguos que LEASE_MS ya no pueden estar vivos; límite exacto", () => {
    expect(ejecucionViva("inProgress", T0, T0 + LEASE_MS - 1)).toBe(true);
    expect(ejecucionViva("inProgress", T0, T0 + LEASE_MS)).toBe(false);
    expect(ejecucionViva("pending", T0, T0 + LEASE_MS + 1)).toBe(false);
  });

  test("LEASE_MS es al menos 30 min del runtime Convex + margen (no bajarlo sin ver el motivo)", () => {
    expect(LEASE_MS).toBeGreaterThanOrEqual((30 + 5) * 60 * 1000);
  });

  test("registroBloquea: un terminal nunca bloquea, aunque su función siga pending", () => {
    for (const status of ["completado", "fallo_preparacion", "cambio_no_confirmado", "fallo_invalidacion", "inconcluso_supersedido"]) {
      expect(registroBloquea({ status, startedAt: T0 }, "inProgress", T0 + 1)).toBe(false);
    }
    for (const status of ["iniciado", "contrasena_cambiada"]) {
      expect(registroBloquea({ status, startedAt: T0 }, "inProgress", T0 + 1)).toBe(true);
      // Registro no cerrado pero ejecución terminada: NO bloquea (sin espera de 35 min).
      expect(registroBloquea({ status, startedAt: T0 }, "success", T0 + 1)).toBe(false);
      expect(registroBloquea({ status, startedAt: T0 }, "failed", T0 + 1)).toBe(false);
    }
  });
});

describe("clasificarResultado: solo mensajes canónicos desde el estado auditado", () => {
  const reg = (estado: string, extra: object = {}) => ({ estado, ...extra });

  test("pending e inProgress → esperar", () => {
    expect(clasificarResultado("r", "pending", reg("iniciado"), 0)).toEqual({ kind: "esperar" });
    expect(clasificarResultado("r", "inProgress", reg("iniciado"), 0)).toEqual({ kind: "esperar" });
  });

  test("success + completado → A (con historialPrevioPendiente solo si quedan previos)", () => {
    expect(clasificarResultado("r", "success", reg("completado"), 0)).toEqual({
      kind: "ok",
      result: { ok: true, requestId: "r" },
    });
    expect(clasificarResultado("r", "success", reg("completado"), 2)).toEqual({
      kind: "ok",
      result: { ok: true, requestId: "r", historialPrevioPendiente: true },
    });
  });

  test("success + registro sin cerrar → B", () => {
    for (const estado of ["iniciado", "contrasena_cambiada"]) {
      expect(clasificarResultado("r", "success", reg(estado), 0)).toEqual({
        kind: "ok",
        result: { ok: true, requestId: "r", auditoriaPendiente: true },
      });
    }
  });

  test("failed + fallo_preparacion / fallo_invalidacion → mensajes canónicos", () => {
    const prep = clasificarResultado("r", "failed", reg("fallo_preparacion"), 0);
    expect(prep).toMatchObject({ kind: "error" });
    expect((prep as { message: string }).message).toContain("No se intentó cambiar la contraseña");
    const c = clasificarResultado("r", "failed", reg("fallo_invalidacion"), 0);
    expect((c as { message: string }).message).toContain("CONTRASEÑA CAMBIADA");
  });

  test("failed + cambio_no_confirmado: D1 si verificado a 0, D2 en otro caso", () => {
    const d1 = clasificarResultado(
      "r",
      "failed",
      reg("cambio_no_confirmado", { sessionsRemaining: 0, sessionsAbsentAfterCheck: 2 }),
      0,
    ) as { message: string };
    expect(d1.message).toContain("NO CONFIRMADO");
    expect(d1.message).toContain("NO es un estado seguro");
    const d2 = clasificarResultado(
      "r",
      "failed",
      reg("cambio_no_confirmado", { sessionsRemaining: 3 }),
      0,
    ) as { message: string };
    expect(d2.message).toContain("CRÍTICO");
    const d2b = clasificarResultado("r", "failed", reg("cambio_no_confirmado"), 0) as { message: string };
    expect(d2b.message).toContain("CRÍTICO");
  });

  test("no clasificable (registro sin cerrar o ausente, success inesperado, fila purgada) → genérico conservador con requestId, tratado como D2", () => {
    for (const [ejecucion, registro] of [
      ["failed", reg("iniciado")],
      ["canceled", reg("contrasena_cambiada")],
      ["failed", null],
      ["desconocida", null],
      ["success", reg("fallo_invalidacion")],
      ["failed", reg("completado")],
    ] as const) {
      const c = clasificarResultado("req-9", ejecucion, registro, 0) as { kind: string; message: string };
      expect(c.kind).toBe("error");
      expect(c.message).toContain("req-9");
      expect(c.message).toContain("Trátalo como D2");
      expect(c.message).toContain("REINTENTA AHORA");
      expect(c.message).toContain("NO retires RESET_PASSWORD");
    }
  });
});

describe("transiciones de auditoría y orden causal", () => {
  test("canTransition: solo iniciado y contrasena_cambiada admiten cambios; los terminales no", () => {
    expect(canTransition("iniciado", "completado")).toBe(true);
    expect(canTransition("iniciado", "cambio_no_confirmado")).toBe(true);
    expect(canTransition("contrasena_cambiada", "completado")).toBe(true);
    expect(canTransition("contrasena_cambiada", "fallo_invalidacion")).toBe(true);
    expect(canTransition("contrasena_cambiada", "cambio_no_confirmado")).toBe(false);
    expect(canTransition("iniciado", "iniciado")).toBe(false);
    for (const terminal of [
      "completado",
      "fallo_preparacion",
      "cambio_no_confirmado",
      "fallo_invalidacion",
      "inconcluso_supersedido",
    ]) {
      for (const to of ["completado", "fallo_invalidacion", "contrasena_cambiada"]) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
    expect(canTransition("iniciado", "fallo_cambio")).toBe(false);
    expect(canTransition("iniciado", "inconcluso_supersedido")).toBe(false);
  });

  test("esPrevio: solo con _creationTime menor estricto (igual o mayor no es previo)", () => {
    expect(esPrevio({ _creationTime: 1 }, { _creationTime: 2 })).toBe(true);
    expect(esPrevio({ _creationTime: 2 }, { _creationTime: 2 })).toBe(false);
    expect(esPrevio({ _creationTime: 3 }, { _creationTime: 2 })).toBe(false);
  });
});
