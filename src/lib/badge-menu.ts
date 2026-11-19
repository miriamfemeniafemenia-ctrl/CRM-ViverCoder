// Lógica pura del badge con menú de la ficha P3 (`BadgeMenu`): prioridad
// (ARC-33) y estado de venta (ARC-18). El componente
// (src/components/badge-menu.tsx) solo conecta eventos y foco.

// Texto accesible del badge: «Prioridad: Alta. Cambiar prioridad».
export function badgeAriaLabel(name: string, label: string, saving: boolean): string {
  return saving
    ? `${name}: ${label}, guardando…`
    : `${name}: ${label}. Cambiar ${name.toLowerCase()}`;
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
    run<R>(fn: () => Promise<R>): false | Promise<R> {
      if (busy) return false;
      busy = true;
      let pending: Promise<R>;
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

// Ancho máximo que puede ocupar el menú (opción más larga: «Presupuesto
// enviado» con su marca ✓). El menú lleva `max-w-[13rem]`, así que nunca pasa
// de aquí.
export const MENU_MAX_WIDTH_PX = 208;
const VIEWPORT_MARGIN_PX = 8;

// Hacia dónde se abre el menú: alineado con el borde izquierdo del badge si
// cabe hasta el borde derecho de la pantalla; si no (badge pegado a la derecha
// en un móvil), alineado con su borde derecho.
export function menuAlign(
  buttonLeft: number,
  viewportWidth: number,
  menuWidth: number = MENU_MAX_WIDTH_PX,
): "start" | "end" {
  return buttonLeft + menuWidth <= viewportWidth - VIEWPORT_MARGIN_PX ? "start" : "end";
}
