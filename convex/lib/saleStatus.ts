import { v } from "convex/values";

// Contrato único del estado de venta de un cliente (D1; F7/ARC-18 lo hace
// editable desde la ficha P3). Lo usan el schema y `clients.setSaleStatus`. La
// copia de la interfaz es `SALE_STATUS_OPTIONS` en src/lib/sale-status.ts; su
// prueba compara los valores con este validador.
//
// Solo importa `convex/values` para que el schema pueda usarlo sin crear una
// dependencia circular con `_generated` (mismo criterio que priority.ts).
export const saleStatusValidator = v.union(
  v.literal("interesado"),
  v.literal("presupuesto"),
  v.literal("cerrado"),
  v.literal("perdido"),
);
