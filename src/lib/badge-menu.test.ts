import { describe, expect, test } from "vitest";
import { badgeAriaLabel, createSaveGuard, menuAlign, nextIndex } from "./badge-menu";

describe("nextIndex", () => {
  test("flechas circulares, Inicio y Fin", () => {
    expect(nextIndex(0, "ArrowDown", 3)).toBe(1);
    expect(nextIndex(2, "ArrowDown", 3)).toBe(0);
    expect(nextIndex(0, "ArrowUp", 3)).toBe(2);
    expect(nextIndex(2, "ArrowUp", 3)).toBe(1);
    expect(nextIndex(1, "Home", 3)).toBe(0);
    expect(nextIndex(1, "End", 3)).toBe(2);
    // Con 4 opciones (estado de venta) también es circular.
    expect(nextIndex(3, "ArrowDown", 4)).toBe(0);
    expect(nextIndex(0, "ArrowUp", 4)).toBe(3);
  });

  test("otras teclas o lista vacía no mueven el foco", () => {
    expect(nextIndex(1, "a", 3)).toBeNull();
    expect(nextIndex(1, "Enter", 3)).toBeNull();
    expect(nextIndex(0, "ArrowDown", 0)).toBeNull();
  });
});

describe("badgeAriaLabel", () => {
  test("con y sin guardado, para prioridad y estado de venta", () => {
    expect(badgeAriaLabel("Prioridad", "Alta", false)).toBe(
      "Prioridad: Alta. Cambiar prioridad",
    );
    expect(badgeAriaLabel("Prioridad", "Baja", true)).toBe("Prioridad: Baja, guardando…");
    expect(badgeAriaLabel("Estado de venta", "Interesado", false)).toBe(
      "Estado de venta: Interesado. Cambiar estado de venta",
    );
    expect(badgeAriaLabel("Estado de venta", "Cerrado", true)).toBe(
      "Estado de venta: Cerrado, guardando…",
    );
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

  test("devuelve el resultado de la función (lo usa el aviso de venta cerrada)", async () => {
    const guard = createSaveGuard();
    expect(await guard.run(async () => ({ changed: true }))).toEqual({ changed: true });
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

describe("menuAlign", () => {
  test("se abre hacia la derecha si cabe; si no, alineado a la derecha del badge", () => {
    expect(menuAlign(20, 343)).toBe("start");
    expect(menuAlign(127, 343)).toBe("start"); // 127 + 208 = 335 = 343 − 8
    expect(menuAlign(128, 343)).toBe("end");
    expect(menuAlign(250, 343)).toBe("end");
    expect(menuAlign(500, 1440)).toBe("start");
  });
});
