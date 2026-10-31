import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { isValidISODate, NOTE_MAX_LENGTH } from "./lib/validation";

// D3 — Recordatorio. Alta desde la sub-pantalla "Nuevo recordatorio" (ARC-15)
// con asignación a un usuario del equipo (ARC-60), y edición/borrado desde P3
// (ARC-61) y P1 (ARC-70). El resto de F5 (marcar como hecho, filtros, pestaña
// "Próximas"...) queda fuera de este alcance — ver ARC-62, ARC-63, ARC-65 (el contador
// del menú: `countDueByAssignee`).
//
// Reglas de negocio:
// - Visibilidad total entre los 3 miembros de la oficina: ni `clients.get` ni
//   `clients.list` aplican control de acceso por usuario (PRD de ARC-16) y
//   este archivo mantiene la misma invariante. Se sostiene porque
//   convex/auth.ts bloquea el registro (`signUp`) y convex/seed.ts crea solo
//   las 3 cuentas: estar autenticado equivale a ser de la oficina. Si se abre
//   el registro o se segmenta por cliente/equipo, la autorización tiene que
//   pasar a `get`, `update` y `remove`.
// - `update` tiene control optimista sin tocar el schema: el cliente manda los
//   valores con los que abrió el formulario (`expectedDate`, `expectedNote`,
//   `expectedAssignedToId`) y el servidor rechaza el guardado si alguno ya no
//   coincide (ARC-61 la fecha, ARC-71 nota y responsable). Convex serializa
//   las mutations, así que comprobación y patch son atómicos. Es comparación
//   por valor, no control de versión: un cambio A→B→A entre la carga y el
//   guardado no se detecta (el resultado coincide con el original).
// - `remove` es idempotente: borrar algo que ya no existe es éxito.

// Duplicada (con la misma lógica) en src/lib/reminders.ts: Convex solo
// empaqueta `convex/`, Next.js solo empaqueta `src/`, no comparten build.
// Si se toca una, tocar la otra.
function todayISODateMadrid() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("No se pudo calcular la fecha de hoy (Europe/Madrid)");
  }
  return `${year}-${month}-${day}`;
}

// Error con texto para el usuario: el cliente solo muestra los que llevan
// `userMessage` (src/lib/reminders.ts); cualquier otro error, o un ConvexError
// sin esa forma, cae en un mensaje genérico.
function userError(userMessage: string) {
  return new ConvexError({ userMessage });
}

// Reglas de nota y fecha compartidas por `create` y `update`. Devuelve la nota
// ya recortada.
function validateNoteAndDate(rawNote: string, date: string) {
  const note = rawNote.trim();
  if (!note) {
    throw userError("La nota es obligatoria");
  }
  if (note.length > NOTE_MAX_LENGTH) {
    throw userError(`La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`);
  }
  if (!isValidISODate(date)) {
    throw userError("La fecha no es válida");
  }
  return note;
}

function assertNotPastDate(date: string) {
  if (date < todayISODateMadrid()) {
    throw userError("La fecha de seguimiento no puede ser anterior a hoy");
  }
}

async function assertAssigneeExists(ctx: QueryCtx, assignedToId: Id<"users">) {
  if (!(await ctx.db.get(assignedToId))) {
    throw userError("El usuario asignado no existe");
  }
}

export const create = mutation({
  args: {
    clientId: v.id("clients"),
    date: v.string(),
    note: v.string(),
    assignedToId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    const note = validateNoteAndDate(args.note, args.date);
    assertNotPastDate(args.date);
    const client = await ctx.db.get(args.clientId);
    if (!client) {
      throw userError("El cliente no existe");
    }
    await assertAssigneeExists(ctx, args.assignedToId);
    return await ctx.db.insert("reminders", {
      clientId: args.clientId,
      date: args.date,
      note,
      status: "pendiente",
      createdById: userId,
      assignedToId: args.assignedToId,
    });
  },
});

// `id` llega de la URL: se normaliza para que uno mal escrito o de otra tabla
// devuelva null (pantalla "no se encontró") en vez de lanzar un error. Un
// recordatorio ya atendido tampoco se abre para editar.
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const id = ctx.db.normalizeId("reminders", args.id);
    const reminder = id === null ? null : await ctx.db.get(id);
    return reminder?.status === "pendiente" ? reminder : null;
  },
});

export const update = mutation({
  args: {
    id: v.id("reminders"),
    // Fecha con la que el usuario abrió el formulario: permite avisar si otra
    // sesión la cambió mientras tanto, en vez de un error de fecha confuso.
    expectedDate: v.string(),
    // Igual para nota (tal como está guardada, ya recortada) y responsable.
    expectedNote: v.string(),
    expectedAssignedToId: v.id("users"),
    date: v.string(),
    note: v.string(),
    assignedToId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    const note = validateNoteAndDate(args.note, args.date);
    const reminder = await ctx.db.get(args.id);
    if (!reminder) {
      throw userError("El recordatorio no existe");
    }
    if (reminder.status !== "pendiente") {
      throw userError("El recordatorio ya está atendido");
    }
    if (
      reminder.date !== args.expectedDate ||
      reminder.note !== args.expectedNote ||
      reminder.assignedToId !== args.expectedAssignedToId
    ) {
      throw userError("El recordatorio ha cambiado en otra sesión; vuelve a abrirlo");
    }
    // Un recordatorio vencido se puede editar sin obligar a cambiar su fecha:
    // solo una fecha nueva tiene que ser de hoy en adelante.
    if (args.date !== reminder.date) {
      assertNotPastDate(args.date);
    }
    await assertAssigneeExists(ctx, args.assignedToId);
    await ctx.db.patch(args.id, {
      date: args.date,
      note,
      assignedToId: args.assignedToId,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    const reminder = await ctx.db.get(args.id);
    if (!reminder) {
      return;
    }
    // Igual que `update`: un recordatorio ya atendido es historial de trabajo
    // hecho y no se borra desde P3.
    if (reminder.status !== "pendiente") {
      throw userError("El recordatorio ya está atendido");
    }
    await ctx.db.delete(args.id);
  },
});

// P1 — recordatorios pendientes de quien está conectado, con el nombre del
// cliente. Sin filtrar por fecha (vencidos, de hoy y futuros): el corte por
// "hoy" es ARC-63, la pestaña "Próximas" es ARC-62, ninguno de los dos entra
// en este ticket. userId siempre sale de la sesión (getAuthUserId), nunca de
// un argumento — no hay forma de pedir la lista de otra persona.
// Volumen esperado: unas decenas de pendientes por usuario (3 cuentas fijas
// en total, sin alta pública — ver convex/auth.ts). Si crece, sustituir
// by_assignedTo_status por un índice ["assignedToId", "status", "date"] y
// paginar con .paginate() (no es solo "añadir date": es un índice nuevo).
export const listPendingByAssignee = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_assignedTo_status", (q) =>
        q.eq("assignedToId", userId).eq("status", "pendiente"),
      )
      .collect();
    const clientIds = [...new Set(reminders.map((r) => r.clientId))];
    const clients = await Promise.all(clientIds.map((id) => ctx.db.get(id)));
    const clientNameById = new Map(
      clientIds.map((id, i) => [id, clients[i]?.name ?? null]),
    );
    return reminders
      .map((r) => ({ ...r, clientName: clientNameById.get(r.clientId) ?? null }))
      .sort((a, b) => a.date.localeCompare(b.date) || a._id.localeCompare(b._id));
  },
});

// Insignia de «Tareas de hoy» del menú (ARC-65): cuántos recordatorios
// pendientes del usuario conectado vencen hoy o están vencidos. Devuelve solo un
// número: el menú está en toda la app y no debe llevar al navegador clientes ni
// notas solo para contar.
//
// `today` lo manda el cliente (Europe/Madrid, `useTodayMadrid`): una query de
// Convex es reactiva y cacheada, no debe depender del reloj del servidor. Solo
// acota los recordatorios del propio usuario, no abre acceso a nada. «Hoy o
// vencido» es `date <= today`, la misma definición que `splitRemindersByToday`
// en src/lib/reminders.ts (si se toca una, tocar la otra).
//
// Límite operativo: el índice no incluye `date`, así que cada llamada recorre
// todos los pendientes de ese usuario (hoy, decenas). Aceptable con 3 usuarios;
// si el volumen crece, vigilar lecturas/latencia en el panel de Convex y pasar a
// un índice ["assignedToId", "status", "date"] con `lte("date", today)` (cambio
// de schema aparte).
export const countDueByAssignee = query({
  args: { today: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    // Sin sesión se devuelve antes de tocar la base de datos.
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    if (!isValidISODate(args.today)) throw userError("La fecha no es válida");
    const pending = await ctx.db
      .query("reminders")
      .withIndex("by_assignedTo_status", (q) =>
        q.eq("assignedToId", userId).eq("status", "pendiente"),
      )
      .collect();
    return pending.filter((r) => r.date <= args.today).length;
  },
});

export const listPendingByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    return reminders.filter((r) => r.status === "pendiente");
  },
});
