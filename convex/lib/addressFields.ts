import { v } from "convex/values";

// Contrato único de la dirección de un cliente (D1, ARC-49/ARC-66). Lo usan el
// schema y la validación de entrada (clientInput.ts): si se toca aquí, cambia
// en todas las capas a la vez.
//
// Los 6 subcampos son opcionales a propósito: se puede guardar una dirección
// parcial (por ejemplo solo código postal y población). Una dirección con todos
// los subcampos vacíos no se guarda (`address` queda `undefined`).
//
// Solo importa `convex/values` para que el schema pueda usarlo sin crear una
// dependencia circular con `_generated`.
export const addressValidator = v.object({
  street: v.optional(v.string()),
  number: v.optional(v.string()),
  floorDoor: v.optional(v.string()),
  postalCode: v.optional(v.string()),
  city: v.optional(v.string()),
  province: v.optional(v.string()),
});
