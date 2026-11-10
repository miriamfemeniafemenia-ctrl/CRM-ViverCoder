// Pruebas de la lógica del restablecimiento de contraseña (ARC-75) con
// dependencias simuladas: fallos parciales, orden de los pasos y que la
// contraseña no sale nunca en logs, errores ni resultado.
import { describe, expect, test } from "vitest";
import {
  type AuditPatch,
  type ResetDeps,
  MAX_INVALIDATION_ATTEMPTS,
  runReset,
} from "./passwordReset";

const EMAIL = "miriam@arco.test";
const PASSWORD = "clave-secreta-de-prueba";

type Harness = ReturnType<typeof harness>;

function harness(overrides: Partial<ResetDeps> = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const audit: { requestId: string; userId: string; patches: AuditPatch[] }[] = [];
  let sessions = 2;
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
      return { sessionIds: sessions > 0 ? ["s1", "s2"] : [], sessions, refreshTokens: sessions };
    },
    modifyPassword: async () => {
      calls.push("modifyPassword");
    },
    invalidateSessions: async () => {
      calls.push("invalidateSessions");
      sessions = 0;
    },
    superseder: async () => {
      calls.push("superseder");
      return 1;
    },
    now: () => 1000,
    log: (m) => logs.push(m),
    ...overrides,
  };
  return { deps, calls, logs, audit, setSessions: (n: number) => (sessions = n) };
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

const finalStatus = (h: Harness) => h.audit[0]?.patches.at(-1)?.status;

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
    expect(h.audit[0].patches.at(-1)).toMatchObject({
      status: "completado",
      sessionsRemaining: 0,
      sessionsInvalidated: 2,
    });
  });

  test("la contraseña no aparece en logs, auditoría ni resultado", async () => {
    const h = harness();
    const result = await runReset(h.deps, EMAIL);
    const everything = JSON.stringify([h.logs, h.audit, result]);
    expect(everything).not.toContain(PASSWORD);
  });

  test("una invalidación que falla una vez se reintenta y acaba en A", async () => {
    let n = 0;
    const h = harness();
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      if (++n === 1) throw new Error("fallo transitorio");
      h.setSessions(0);
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
      h.setSessions(invalidations === 1 ? 1 : 0);
    };
    const result = await runReset(h.deps, EMAIL);
    expect(result.ok).toBe(true);
    expect(invalidations).toBe(2);
  });
});

describe("runReset: fallos parciales", () => {
  test("falla el cambio de contraseña → fallo_cambio, no se invalida ni se supersede", async () => {
    const h = harness({ modifyPassword: failing(`clave ${PASSWORD} inválida`) });
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(finalStatus(h)).toBe("fallo_cambio");
    expect(h.calls).not.toContain("invalidateSessions");
    expect(h.calls).not.toContain("superseder");
    expect(message).not.toContain(PASSWORD);
  });

  test("si toda la auditoría falla tras cambiar la contraseña, la invalidación SIGUE y es resultado B", async () => {
    const h = harness({ updateAudit: failing("auditoría caída") });
    const result = await runReset(h.deps, EMAIL);
    expect(h.calls).toContain("invalidateSessions");
    expect(result).toEqual({ ok: true, requestId: "req-1", auditoriaPendiente: true });
    // B nunca supersede registros previos.
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

  test("la invalidación falla siempre → C: lanza, no declara éxito, fallo_invalidacion y sin supersesión", async () => {
    const h = harness();
    h.deps.invalidateSessions = async () => {
      h.calls.push("invalidateSessions");
      throw new Error("fallo permanente");
    };
    const message = await rejection(runReset(h.deps, EMAIL));
    expect(message).toContain("CONTRASEÑA CAMBIADA");
    expect(message).toContain("NO se han invalidado");
    expect(finalStatus(h)).toBe("fallo_invalidacion");
    expect(h.calls.filter((c) => c === "invalidateSessions")).toHaveLength(
      MAX_INVALIDATION_ATTEMPTS,
    );
    expect(h.calls).not.toContain("superseder");
    expect(h.calls).not.toContain("updateAudit:completado");
  });

  test("no se puede verificar el recuento → C (sin evidencia no hay éxito)", async () => {
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
  });
});

describe("runReset: supersesión de registros previos", () => {
  test("si superseder falla tras un A, el reset no se degrada y se avisa", async () => {
    const h = harness({ superseder: failing("fallo") });
    const result = await runReset(h.deps, EMAIL);
    expect(result).toEqual({ ok: true, requestId: "req-1", historialPrevioPendiente: true });
    expect(finalStatus(h)).toBe("completado");
  });

  test("un reset que falla después de abrir su auditoría no supersede nada", async () => {
    const h = harness({ modifyPassword: failing() });
    await rejection(runReset(h.deps, EMAIL));
    expect(h.calls).not.toContain("superseder");
  });
});
