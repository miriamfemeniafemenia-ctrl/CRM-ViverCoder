// Pruebas de la lógica del restablecimiento de contraseña (ARC-75) con
// dependencias simuladas: fallos parciales, orden de los pasos, resultados
// A/B/C/D1/D2 y que la contraseña no sale nunca en logs, errores ni resultado.
import { describe, expect, test } from "vitest";
import {
  type AuditPatch,
  type ResetDeps,
  MAX_INVALIDATION_ATTEMPTS,
  canTransition,
  esPrevio,
  runReset,
} from "./passwordReset";

const EMAIL = "miriam@arco.test";
const PASSWORD = "clave-secreta-de-prueba";

type Harness = ReturnType<typeof harness>;

function harness(overrides: Partial<ResetDeps> = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const audit: { requestId: string; userId: string; patches: AuditPatch[] }[] = [];
  // Estado simulado de la cuenta: contraseña cambiada y sesiones vivas.
  const state = { passwordChanged: false, sessions: 2 };
  const deps: ResetDeps = {
    allowedEmails: () => [EMAIL, "monica@arco.test"],
    readPassword: () => PASSWORD,
    findUserId: async () => "user1",
    newRequestId: () => "req-1",
    openAudit: async (requestId, userId) => {
      calls.push("openAudit");
      audit.push({ requestId, userId, patches: [] });
    },
    updateAudit: async (requestId, patch) => {
      calls.push(`updateAudit:${patch.status}`);
      audit.find((a) => a.requestId === requestId)?.patches.push(patch);
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
  return { deps, calls, logs, audit, state };
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

const finalPatch = (h: Harness) => h.audit[0]?.patches.at(-1);
const finalStatus = (h: Harness) => finalPatch(h)?.status;

describe("runReset: validaciones previas (no tocan nada)", () => {
  test("email fuera de la lista de las 3 cuentas → rechaza sin abrir auditoría ni cambiar nada", async () => {
    const h = harness();
    await rejection(runReset(h.deps, "otra@arco.test"));
    expect(h.calls).toEqual([]);
  });

  test("sin contraseña o con menos de 8 caracteres → rechaza sin tocar nada y sin imprimirla", async () => {
    for (const value of [undefined, "", "corta"]) {
      const h = harness({ readPassword: () => value });
      const message = await rejection(runReset(h.deps, EMAIL));
      expect(h.calls).toEqual([]);
      if (value) expect(message).not.toContain(value);
    }
  });

  test("cuenta inexistente → rechaza y no abre auditoría", async () => {
    const h = harness({ findUserId: async () => null });
    await rejection(runReset(h.deps, EMAIL));
    expect(h.calls).toEqual([]);
  });

  test("si no se puede abrir la auditoría, no se cambia la contraseña", async () => {
    const h = harness({ openAudit: failing() });
    await rejection(runReset(h.deps, EMAIL));
    expect(h.calls).not.toContain("modifyPassword");
    expect(h.calls).not.toContain("invalidateSessions");
  });

  test("mayúsculas y espacios en el email se normalizan", async () => {
    const h = harness();
    const result = await runReset(h.deps, `  ${EMAIL.toUpperCase()} `);
    expect(result.ok).toBe(true);
  });
});

describe("runReset: preparación (fallo_preparacion)", () => {
  test("la lectura previa de sesiones falla → fallo_preparacion, no se intenta cambiar ni invalidar nada", async () => {
    const h = harness({ sessionState: failing("consulta caída") });
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(finalStatus(h)).toBe("fallo_preparacion");
    expect(h.calls).not.toContain("modifyPassword");
    expect(h.calls).not.toContain("invalidateSessions");
    expect(h.calls).not.toContain("superseder");
    expect(message).toContain("No se intentó cambiar la contraseña");
    expect(h.state.passwordChanged).toBe(false);
  });
});

describe("runReset: resultado A", () => {
  test("orden: auditoría → cambio → invalidación → verificación → completado → supersesión", async () => {
    const h = harness();
    const result = await runReset(h.deps, EMAIL);
    expect(result).toEqual({ ok: true, requestId: "req-1", registrosSupersedidos: 1 });
    expect(h.calls.indexOf("openAudit")).toBeLessThan(h.calls.indexOf("modifyPassword"));
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
    // El campo antiguo ya no existe.
    expect(finalPatch(h)).not.toHaveProperty("sessionsInvalidated");
  });

  test("la contraseña no aparece en logs, auditoría ni resultado", async () => {
    const h = harness();
    const result = await runReset(h.deps, EMAIL);
    expect(JSON.stringify([h.logs, h.audit, result])).not.toContain(PASSWORD);
  });

  test("una invalidación que falla una vez se reintenta y acaba en A", async () => {
    let n = 0;
    const h = harness();
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      if (++n === 1) throw new Error("fallo transitorio");
      h.state.sessions = 0;
    };
    const result = await runReset(h.deps, EMAIL);
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
      // La primera invalidación deja una sesión nueva (carrera); la segunda la borra.
      h.state.sessions = invalidations === 1 ? 1 : 0;
    };
    const result = await runReset(h.deps, EMAIL);
    expect(result.ok).toBe(true);
    expect(invalidations).toBe(2);
  });
});

describe("runReset: B (auditoría pendiente) y C (sesiones no invalidadas)", () => {
  test("si toda la auditoría falla tras cambiar la contraseña, la invalidación SIGUE y es resultado B", async () => {
    const h = harness({ updateAudit: failing("auditoría caída") });
    const result = await runReset(h.deps, EMAIL);
    expect(h.calls).toContain("invalidateSessions");
    expect(result).toEqual({ ok: true, requestId: "req-1", auditoriaPendiente: true });
    expect(h.calls).not.toContain("superseder");
  });

  test("falla solo el estado final: B, y el reset ya había invalidado las sesiones", async () => {
    const h = harness();
    h.deps.updateAudit = async (_id, patch) => {
      h.calls.push(`updateAudit:${patch.status}`);
      if (patch.status === "completado") throw new Error("auditoría caída");
    };
    const result = await runReset(h.deps, EMAIL);
    expect(result.auditoriaPendiente).toBe(true);
    expect(h.calls).toContain("invalidateSessions");
  });

  test("la invalidación falla siempre → C: lanza, fallo_invalidacion, solo sessionsRemaining, sin supersesión", async () => {
    const h = harness();
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      throw new Error("fallo permanente");
    };
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(message).toContain("CONTRASEÑA CAMBIADA");
    expect(message).toContain("NO se han invalidado");
    expect(finalStatus(h)).toBe("fallo_invalidacion");
    // No se afirma ninguna comprobación a cero que no ocurrió.
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
    const message = await rejection(runReset(h.deps, EMAIL));
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
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(h.calls).toContain("invalidateSessions");
    expect(h.state.sessions).toBe(0);
    expect(finalStatus(h)).toBe("cambio_no_confirmado");
    expect(finalPatch(h)).toMatchObject({ sessionsAbsentAfterCheck: 2, sessionsRemaining: 0 });
    expect(message).toContain("NO CONFIRMADO");
    expect(message).toContain("puede seguir siendo válida");
    expect(message).toContain("REINTENTA AHORA");
    expect(message).toContain("NO retires RESET_PASSWORD");
    // El estado `fallo_cambio` ya no existe: nunca se escribe.
    expect(h.audit[0].patches.map((p) => p.status as string)).not.toContain("fallo_cambio");
    expect(h.calls).not.toContain("updateAudit:contrasena_cambiada");
    expect(h.calls).not.toContain("superseder");
  });

  test("modifyPassword lanza SIN aplicar el cambio: mismo flujo, y un inicio con la contraseña antigua tras la verificación no se trata como seguro", async () => {
    const h = harness();
    h.deps.modifyPassword = failing("fallo antes del commit");
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(h.state.passwordChanged).toBe(false);
    expect(h.state.sessions).toBe(0);
    // La contraseña anterior sigue valiendo: se abre una sesión nueva DESPUÉS de la
    // verificación. Nadie la considera legítima ni la detecta: el resultado ya fue D.
    h.state.sessions = 1;
    expect(finalStatus(h)).toBe("cambio_no_confirmado");
    expect(message).toContain("NO es un estado seguro");
    expect(message).toContain("puede seguir siendo válida");
    expect(message).toContain("pueden abrirse sesiones nuevas con ella");
    expect(h.calls).not.toContain("updateAudit:completado");
  });

  test("D2: modifyPassword lanza Y la invalidación falla siempre → error crítico, solo sessionsRemaining, nunca éxito", async () => {
    const h = harness();
    h.deps.modifyPassword = failing();
    h.deps.invalidateSessions = failing("fallo permanente");
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(message).toContain("CRÍTICO");
    expect(message).toContain("NO invalidados");
    expect(message).toContain("REINTENTA AHORA");
    expect(finalStatus(h)).toBe("cambio_no_confirmado");
    expect(finalPatch(h)).not.toHaveProperty("sessionsAbsentAfterCheck");
    expect(finalPatch(h)).toMatchObject({ sessionsRemaining: 4 });
  });

  test("el mensaje de error no contiene la contraseña", async () => {
    const h = harness({ modifyPassword: failing(`clave ${PASSWORD} inválida`) });
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(message).not.toContain(PASSWORD);
    expect(JSON.stringify([h.logs, h.audit])).not.toContain(PASSWORD);
  });
});

describe("runReset: supersesión de registros previos", () => {
  test("si superseder falla tras un A, el reset no se degrada y se avisa", async () => {
    const h = harness({ superseder: failing("fallo") });
    const result = await runReset(h.deps, EMAIL);
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
      await rejection(runReset(h.deps, EMAIL));
      expect(h.calls).not.toContain("superseder");
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
