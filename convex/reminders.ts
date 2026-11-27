import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getTeamUser, requireTeamUser } from "./lib/team";
import { isValidISODate, NOTE_MAX_LENGTH, todayISODateMadrid } from "./lib/validation";

// D3 — Recordatorio. Alta desde la sub-pantalla "Nuevo recordatorio" (ARC-15)
// con asignación a un usuario del equipo (ARC-60), edición/borrado desde P3
// (ARC-61) y P1 (ARC-70), y «marcar como hecho» desde las dos (`complete`,
// ARC-16). Filtros y pestaña "Próximas" de P1: ARC-62, ARC-63; el contador del
// menú: `countDueByAssignee` (ARC-65).
//
// Reglas de negocio:
// - Visibilidad total entre los 3 miembros de la oficina: ni `clients.get` ni
//   `clients.list` aplican control de acceso por usuario (PRD de ARC-16) y
//   este archivo mantiene la misma invariante. Se sostiene porque
//   convex/auth.ts bloquea el registro (`signUp`) y convex/seed.ts crea solo
//   las 3 cuentas. Cada handler empieza con el guard de convex/lib/team.ts
//   (`getTeamUser`/`requireTeamUser`: usuario existente con rol del equipo).
//   Si se segmenta por cliente/equipo, la autorización tiene que pasar a
//   `get`, `update` y `remove`.
// - `update` tiene control optimista sin tocar el schema: el cliente manda los
//   valores con los que abrió el formulario (`expectedDate`, `expectedNote`,
//   `expectedAssignedToId`) y el servidor rechaza el guardado si alguno ya no
//   coincide (ARC-61 la fecha, ARC-71 nota y responsable). Convex serializa
//   las mutations, así que comprobación y patch son atómicos. Es comparación
//   por valor, no control de versión: un cambio A→B→A entre la carga y el
//   guardado no se detecta (el resultado coincide con el original).
// - `remove` es idempotente: borrar algo que ya no existe es éxito.
// - `complete` es idempotente sobre un recordatorio ya atendido (conserva quién
//   y cuándo lo marcó la primera vez), pero avisa si ya no existe.

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
    const user = await requireTeamUser(ctx);
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
      createdById: user._id,
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
    const user = await getTeamUser(ctx);
    if (user === null) {
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
    await requireTeamUser(ctx);
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
    await requireTeamUser(ctx);
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

// «Marcar como hecho» desde P3 y P1 (ARC-16): pasa a «atendido» y guarda quién
// (la sesión activa, que puede no ser la persona asignada) y cuándo. Desaparece
// solo de las listas y del contador, que ya filtran por «pendiente»; `get`,
// `update` y `remove` ya lo rechazan.
// - Ya atendido: éxito sin cambios. Si dos personas lo marcan a la vez, la
//   segunda no ve un error y no se pisa la atribución de la primera.
// - Ya no existe (otra sesión lo borró): se avisa, en vez de un éxito silencioso,
//   porque quien lo marca cree estar cerrando algo.
export const complete = mutation({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    const user = await requireTeamUser(ctx);
    const reminder = await ctx.db.get(args.id);
    if (!reminder) {
      throw userError("El recordatorio ya no existe");
    }
    if (reminder.status !== "pendiente") {
      return;
    }
    await ctx.db.patch(args.id, {
      status: "atendido",
      completedAt: Date.now(),
      completedById: user._id,
    });
  },
});

// P1 — recordatorios pendientes de quien está conectado, con el nombre del
// cliente. Sin filtrar por fecha (vencidos, de hoy y futuros): el corte por
// "hoy" es ARC-63, la pestaña "Próximas" es ARC-62, ninguno de los dos entra
// en este ticket. userId siempre sale de la sesión (getTeamUser), nunca de
// un argumento — no hay forma de pedir la lista de otra persona.
// Guard: `getTeamUser` (convex/lib/team.ts).
// Volumen esperado: unas decenas de pendientes por usuario (3 cuentas fijas
// en total, sin alta pública — ver convex/auth.ts). Si crece, sustituir
// by_assignedTo_status por un índice ["assignedToId", "status", "date"] y
// paginar con .paginate() (no es solo "añadir date": es un índice nuevo).
export const listPendingByAssignee = query({
  args: {},
  handler: async (ctx) => {
    const user = await getTeamUser(ctx);
    if (user === null) return [];
    const userId = user._id;
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
    // Sin sesión del equipo se devuelve antes de tocar la base de datos.
    const user = await getTeamUser(ctx);
    if (user === null) return 0;
    const userId = user._id;
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
    const user = await getTeamUser(ctx);
    if (user === null) {
      return [];
    }
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();
    // Mismo orden que `listPendingByAssignee` (ARC-16): por fecha, el más
    // antiguo primero, así los vencidos quedan arriba en P3.
    return reminders
      .filter((r) => r.status === "pendiente")
      .sort((a, b) => a.date.localeCompare(b.date) || a._id.localeCompare(b._id));
  },
});
