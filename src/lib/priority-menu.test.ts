import { describe, expect, test } from "vitest";
import { priorityValidator } from "../../convex/lib/priority";
import {
  createSaveGuard,
  nextIndex,
  priorityAriaLabel,
  priorityBadgeClass,
  priorityLabel,
} from "./priority-menu";

describe("nextIndex", () => {
  test("flechas circulares, Inicio y Fin", () => {
    expect(nextIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextIndex(0, "ArrowUp", 3)).toBe(2);
    expect(nextIndex(2, "ArrowUp", 3)).toBe(1);
    expect(nextIndex(1, "Home", 3)).toBe(0);
    expect(nextIndex(1, "End", 3)).toBe(2);
  });

  test("otras teclas o lista vacía no mueven el foco", () => {
    expect(nextIndex(1, "a", 3)).toBeNull();
    expect(nextIndex(1, "Enter", 3)).toBeNull();
    expect(nextIndex(0, "ArrowDown", 0)).toBeNull();
  });
});

describe("badge de prioridad", () => {
  const serverValues = priorityValidator.members.map((m) => m.value);

  test("cada valor del servidor tiene clase de color y etiqueta propias", () => {
    for (const p of serverValues) {
      expect(priorityBadgeClass(p)).toContain(`bg-priority-${p}-bg`);
      expect(priorityBadgeClass(p)).toContain(`text-priority-${p}-fg`);
      expect(priorityLabel(p)).not.toBe(p);
    }
    expect(new Set(serverValues.map(priorityLabel)).size).toBe(serverValues.length);
  });

  test("texto accesible con y sin guardado", () => {
    expect(priorityAriaLabel("alta", false)).toBe("Prioridad: Alta. Cambiar prioridad");
    expect(priorityAriaLabel("baja", true)).toBe("Prioridad: Baja, guardando…");
  });
});

describe("createSaveGuard", () => {
  function deferred() {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  test("una segunda llamada mientras la primera está pendiente no se ejecuta", async () => {
    const guard = createSaveGuard();
    const first = deferred();
    let calls = 0;
    const p1 = guard.run(() => {
      calls++;
      return first.promise;
    });
    expect(p1).not.toBe(false);
    expect(guard.isBusy()).toBe(true);
    expect(
      guard.run(async () => {
        calls++;
      }),
    ).toBe(false);
    expect(calls).toBe(1);
    first.resolve();
    await p1;
    expect(guard.isBusy()).toBe(false);
    await guard.run(async () => {
      calls++;
    });
    expect(calls).toBe(2);
  });

  test("si la primera falla, el bloqueo se libera igualmente", async () => {
    const guard = createSaveGuard();
    const first = deferred();
    const p1 = guard.run(() => first.promise) as Promise<unknown>;
    first.reject(new Error("fallo"));
    await expect(p1).rejects.toThrow("fallo");
    expect(guard.isBusy()).toBe(false);
    expect(guard.run(async () => {})).not.toBe(false);
  });

  test("si la función lanza de forma síncrona, el bloqueo se libera", async () => {
    const guard = createSaveGuard();
    const p = guard.run(() => {
      throw new Error("síncrono");
    }) as Promise<unknown>;
    await expect(p).rejects.toThrow("síncrono");
    expect(guard.isBusy()).toBe(false);
  });
});
