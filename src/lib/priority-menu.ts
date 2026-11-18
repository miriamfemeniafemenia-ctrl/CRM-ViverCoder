import type { Priority } from "../types";
import { PRIORITY_OPTIONS } from "./client-form";

// Lógica pura del badge de prioridad de P3 (ARC-33). El componente
// (src/components/priority-badge.tsx) solo conecta eventos y foco.

// Clases literales (Tailwind solo genera las que ve escritas en el código).
const BADGE_CLASS: Record<Priority, string> = {
  alta: "bg-priority-alta-bg text-priority-alta-fg",
  media: "bg-priority-media-bg text-priority-media-fg",
  baja: "bg-priority-baja-bg text-priority-baja-fg",
};

export function priorityBadgeClass(priority: Priority): string {
  return BADGE_CLASS[priority];
}

export function priorityLabel(priority: Priority): string {
  return PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? priority;
}

export function priorityAriaLabel(priority: Priority, saving: boolean): string {
  return saving
    ? `Prioridad: ${priorityLabel(priority)}, guardando…`
    : `Prioridad: ${priorityLabel(priority)}. Cambiar prioridad`;
}

// Navegación con teclado dentro del menú: flechas circulares, Inicio y Fin.
// Devuelve null si la tecla no mueve el foco.
export function nextIndex(current: number, key: string, length: number): number | null {
  if (length <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return (current + 1) % length;
    case "ArrowUp":
      return (current - 1 + length) % length;
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return null;
  }
}

// Exclusión mutua de guardados: `run(fn)` no llama a `fn` (y devuelve false) si
// ya hay uno en curso; el bloqueo se libera al terminar, vaya bien o mal. El
// bloqueo es síncrono, así que dos eventos en el mismo tick no pasan los dos.
export function createSaveGuard() {
  let busy = false;
  return {
    isBusy: () => busy,
    run(fn: () => Promise<unknown>): false | Promise<unknown> {
      if (busy) return false;
      busy = true;
      let pending: Promise<unknown>;
      try {
        pending = fn();
      } catch (err) {
        busy = false;
        return Promise.reject(err);
      }
      return pending.finally(() => {
        busy = false;
      });
    },
  };
}
