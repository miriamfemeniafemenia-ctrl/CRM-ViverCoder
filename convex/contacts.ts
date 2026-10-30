import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { insertClient, newClientValidator } from "./lib/clientInput";
import { isValidISODate, NOTE_MAX_LENGTH } from "./lib/validation";

// D2 — Contacto. "Anotar interacción" (ARC-72): registrar qué pasó en una
// llamada, WhatsApp, correo, redes o web con un cliente o posible cliente. El
// historial en la ficha (ARC-14) queda fuera de este alcance.
//
// Reglas de negocio:
// - Dos canales distintos que no se mezclan: `type` es el canal de la
//   INTERACCIÓN (llamada/whatsapp/correo/redes/web); `newClient.channel` es el
//   canal de CAPTACIÓN del cliente nuevo (llamada/whatsapp/web/redes/
//   presencial). No se deduce uno del otro.
// - `createdById` es siempre la sesión activa; `performedById` es quien realizó
//   la interacción (seleccionable, puede ser otra persona).
// - La fecha es libre (pasada o futura): solo se exige que sea una fecha de
//   calendario real.
// - Si el cliente no existe se da de alta en la misma mutation (`newClient`):
//   Convex revierte la transacción entera si algo falla después, así que no
//   queda un cliente huérfano.
// - Visibilidad total entre las 3 cuentas fijas, como en convex/reminders.ts:
//   estar autenticado equivale a ser de la oficina.

// Error con texto para el usuario (ver `userError` en convex/reminders.ts).
function userError(userMessage: string) {
  return new ConvexError({ userMessage });
}

export const create = mutation({
  args: {
    target: v.union(
      v.object({ clientId: v.id("clients") }),
      v.object({ newClient: newClientValidator }),
    ),
    type: v.union(
      v.literal("llamada"),
      v.literal("whatsapp"),
      v.literal("correo"),
      v.literal("redes"),
      v.literal("web"),
    ),
    date: v.string(),
    note: v.string(),
    performedById: v.id("users"),
  },
  returns: v.object({ contactId: v.id("contacts"), clientId: v.id("clients") }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    const note = args.note.trim();
    if (!note) {
      throw userError("La nota es obligatoria");
    }
    if (note.length > NOTE_MAX_LENGTH) {
      throw userError(`La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`);
    }
    if (!isValidISODate(args.date)) {
      throw userError("La fecha no es válida");
    }
    // Todas las comprobaciones previas a escribir van antes de dar de alta al
    // cliente nuevo.
    if (!(await ctx.db.get(args.performedById))) {
      throw userError("El usuario que realizó la interacción no existe");
    }
    let clientId;
    if ("clientId" in args.target) {
      if (!(await ctx.db.get(args.target.clientId))) {
        throw userError("El cliente no existe");
      }
      clientId = args.target.clientId;
    } else {
      clientId = await insertClient(ctx, args.target.newClient);
    }
    const contactId = await ctx.db.insert("contacts", {
      clientId,
      type: args.type,
      date: args.date,
      note,
      performedById: args.performedById,
      createdById: userId,
      createdAt: Date.now(),
    });
    return { contactId, clientId };
  },
});
