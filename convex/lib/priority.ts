import { v } from "convex/values";

// Contrato único de la prioridad de un cliente (D1; ARC-32 la hace editable en
// P4). Lo usan el schema y los argumentos de `clients.create`/`clients.update`
// (clientInput.ts). La copia de la interfaz es `PRIORITY_OPTIONS` en
// src/lib/client-form.ts; su prueba compara los valores con este validador.
//
// Solo importa `convex/values` para que el schema pueda usarlo sin crear una
// dependencia circular con `_generated` (mismo criterio que addressFields.ts).
export const priorityValidator = v.union(
  v.literal("alta"),
  v.literal("media"),
  v.literal("baja"),
);
