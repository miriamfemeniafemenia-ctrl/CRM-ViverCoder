import type { SaleStatus } from "../types";

// Estado de venta en la interfaz (F7/ARC-18). Copia de los valores de
// `saleStatusValidator` (convex/lib/saleStatus.ts); la prueba comprueba que
// coinciden. Lo usan P2 (lista) y P3 (ficha) — antes cada una tenía su tabla y
// la de P3 pintaba siempre los colores de «Interesado» (ARC-77).
export const SALE_STATUS_OPTIONS: readonly { value: SaleStatus; label: string }[] = [
  { value: "interesado", label: "Interesado" },
  { value: "presupuesto", label: "Presupuesto enviado" },
  { value: "cerrado", label: "Cerrado" },
  { value: "perdido", label: "Perdido" },
];

// Clases literales: Tailwind solo genera las que ve escritas en el código.
const SALE_STATUS_BADGE_CLASS: Record<SaleStatus, string> = {
  interesado: "bg-sale-interesado-bg text-sale-interesado-fg",
  presupuesto: "bg-sale-presupuesto-bg text-sale-presupuesto-fg",
  cerrado: "bg-sale-cerrado-bg text-sale-cerrado-fg",
  perdido: "bg-sale-perdido-bg text-sale-perdido-fg",
};

export function saleStatusBadgeClass(status: SaleStatus): string {
  return SALE_STATUS_BADGE_CLASS[status];
}

export function saleStatusLabel(status: SaleStatus): string {
  return SALE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

// Resultado de `clients.setSaleStatus` (lo calcula el servidor dentro de la
// mutation, con el estado real en ese momento).
export type SaleStatusResult = {
  changed: boolean;
  previousSaleStatus: SaleStatus;
  saleStatus: SaleStatus;
};

// Aviso «¡Venta cerrada!» (ARC-19): SOLO si la mutation cambió de verdad el
// estado desde otro distinto de «cerrado» a «cerrado». Se decide con el
// resultado del servidor, nunca con el valor que la ficha tenía en pantalla.
export function shouldShowClosedPrompt(result: SaleStatusResult): boolean {
  return (
    result.changed &&
    result.previousSaleStatus !== "cerrado" &&
    result.saleStatus === "cerrado"
  );
}
