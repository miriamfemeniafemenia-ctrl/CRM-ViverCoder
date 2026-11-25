import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { applySaleStatus, insertClient, newClientValidator } from "./lib/clientInput";
import { saleStatusValidator } from "./lib/saleStatus";
import { getTeamUser, requireTeamUser } from "./lib/team";
import { isValidISODate, NOTE_MAX_LENGTH } from "./lib/validation";

// D2 — Contacto. "Anotar interacción" (ARC-72): registrar qué pasó en una
// llamada, WhatsApp, correo, redes o web con un cliente o posible cliente. El
// historial de la ficha P3 (ARC-14) se lee con `listByClient`.
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
// - `saleStatus` (opcional, F7/ARC-18): cambia el estado de venta del cliente
//   (existente o recién dado de alta) en la misma transacción, con
//   `applySaleStatus` (mismo valor → no escribe). Sin aviso de venta cerrada
//   aquí: la propia nota es la constancia (ARC-19, «opción A»).
// - Visibilidad total entre las 3 cuentas fijas (cartera compartida): guard
//   `requireTeamUser` de convex/lib/team.ts.

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
    // Opcional (F7/ARC-18): sin valor, el estado de venta no se toca.
    saleStatus: v.optional(saleStatusValidator),
  },
  returns: v.object({ contactId: v.id("contacts"), clientId: v.id("clients") }),
  handler: async (ctx, args) => {
    const user = await requireTeamUser(ctx);
    const note = args.note.trim();
    if (!note) {
      throw userError("La nota es obligatoria");
    }
    if (note.length > NOTE_MAX_LENGTH) {
      throw userError(
        `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`,
      );
    }
    if (!isValidISODate(args.date)) {
      throw userError("La fecha no es válida");
    }
    // Todas las comprobaciones previas a escribir van antes de dar de alta al
    // cliente nuevo.
    if (!(await ctx.db.get(args.performedById))) {
      throw userError("El usuario que realizó la interacción no existe");
    }
    let client;
    if ("clientId" in args.target) {
      client = await ctx.db.get(args.target.clientId);
      if (!client) {
        throw userError("El cliente no existe");
      }
    } else {
      const newId = await insertClient(ctx, args.target.newClient);
      client = await ctx.db.get(newId);
      if (!client) {
        throw new Error("El cliente recién creado no se encuentra");
      }
    }
    const clientId = client._id;
    const contactId = await ctx.db.insert("contacts", {
      clientId,
      type: args.type,
      date: args.date,
      note,
      performedById: args.performedById,
      createdById: user._id,
      createdAt: Date.now(),
    });
    // Cambio opcional del estado de venta (F7/ARC-18) en la misma transacción:
    // si algo fallara, no quedaría ni la interacción ni el cambio. El resultado
    // se ignora: aquí no hay aviso de venta cerrada (ARC-19, «opción A»).
    if (args.saleStatus !== undefined) {
      await applySaleStatus(ctx, client, args.saleStatus);
    }
    return { contactId, clientId };
  },
});

// Historial de interacciones de un cliente para la ficha P3 (ARC-14).
//
// - Orden: la fecha de la interacción más reciente primero; con la misma fecha,
//   la última anotada (`createdAt`, y `_creationTime` como desempate final, para
//   que el orden sea siempre el mismo).
// - `.collect()` sin límite es deliberado: el PRD pide el historial completo.
//   Si algún cliente llega a tener cientos de interacciones, hará falta paginar
//   (otro ticket).
// - Proyección mínima: solo los campos que pinta la ficha. Si `contacts` gana
//   campos sensibles, no salen de aquí sin decidirlo.
// - Sin usuario del equipo, lista vacía (guard `getTeamUser`, como el resto de
//   lecturas).
export const listByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const user = await getTeamUser(ctx);
    if (user === null) {
      return [];
    }
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    contacts.sort(
      (a, b) =>
        (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
        b.createdAt - a.createdAt ||
        b._creationTime - a._creationTime,
    );
    return contacts.map((c) => ({
      _id: c._id,
      type: c.type,
      note: c.note,
      date: c.date,
      performedById: c.performedById,
      createdById: c.createdById,
    }));
  },
});
