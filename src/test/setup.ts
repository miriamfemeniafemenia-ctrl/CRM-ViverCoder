import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { resetConvexMock, useMutationMock, useQueryMock } from "./convex-mock";

// Preparación del proyecto `ui` de Vitest (ARC-78): se carga antes de cada
// archivo `*.test.tsx`.

// Convex sin servidor ni red: ver `convex-mock.ts`.
vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useQuery: useQueryMock,
  useMutation: useMutationMock,
}));

// Cada prueba empieza y termina sin DOM, sin respuestas de Convex y sin spies
// de otra prueba.
function resetAll() {
  cleanup();
  resetConvexMock();
  vi.restoreAllMocks();
}
beforeEach(resetAll);
afterEach(resetAll);

// jsdom no implementa `showModal()` ni `close()` de <dialog>. Polyfill mínimo
// con el comportamiento del navegador que usan los componentes:
// - `showModal()` abre y lleva el foco al primer elemento enfocable, como hace
//   el navegador (así una prueba de «el foco vuelve» no pasa por casualidad);
// - `close()` es idempotente: solo si estaba abierto quita `open` y emite
//   `close` una vez. Escape es nativo del navegador; las pruebas lo simulan
//   con `close()`, que es lo que hace el navegador al pulsarlo.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    if (this.open) return;
    this.setAttribute("open", "");
    const focusable = this.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
