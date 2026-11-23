import type { SaleStatus } from "../types";
import { saleStatusLabel } from "./sale-status";

// Reglas de «Anotar interacción» (ARC-72) para el campo opcional «Estado de
// venta» (F7/ARC-18) y la pista de la nota tras una venta cerrada (ARC-19,
// «opción A»). Funciones puras: el componente solo las aplica.

// Motivo con el que se abre el formulario desde el aviso «¡Venta cerrada!» de
// la ficha P3 (`?motivo=venta-cerrada`).
export type ContactMotivo = "venta-cerrada";

// Lee `?motivo=`, que viene de la URL y no es de fiar. Solo el valor exacto
// cuenta; un parámetro repetido es ambiguo y se ignora, como `?clientId=`.
export function parseMotivo(
  raw: string | string[] | undefined,
): ContactMotivo | undefined {
  return raw === "venta-cerrada" ? "venta-cerrada" : undefined;
}

// Primera opción del selector, la que no cambia nada. Con un cliente existente
// muestra su estado actual; un cliente nuevo nace «Interesado».
export function keepSaleStatusLabel(current: SaleStatus | undefined): string {
  return current === undefined
    ? `Sin cambios (${saleStatusLabel("interesado")})`
    : `Sin cambios (ahora: ${saleStatusLabel(current)})`;
}

// Valor del selector → lo que se envía a `contacts.create`. "" = «Sin cambios»:
// no se envía nada y el servidor no toca el estado.
export function saleStatusToSend(choice: SaleStatus | ""): SaleStatus | undefined {
  return choice === "" ? undefined : choice;
}

export const DEFAULT_NOTE_PLACEHOLDER = "Ej.: Pidió presupuesto de hogar";
export const CLOSED_SALE_NOTE_PLACEHOLDER =
  "¿Qué contrató el cliente? Ej: Seguro de coche, póliza de hogar...";

// Pista de la nota. Es solo `placeholder`: nunca se guarda ni se envía, y una
// nota vacía sigue siendo un error (ARC-19, «opción A»).
export function notePlaceholder(
  choice: SaleStatus | "",
  motivo: ContactMotivo | undefined,
): string {
  return choice === "cerrado" || motivo === "venta-cerrada"
    ? CLOSED_SALE_NOTE_PLACEHOLDER
    : DEFAULT_NOTE_PLACEHOLDER;
}
