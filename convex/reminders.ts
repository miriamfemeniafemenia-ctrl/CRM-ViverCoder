import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";

// D3 — Recordatorio. Alta desde la sub-pantalla "Nuevo recordatorio" (ARC-15)
// con asignación a un usuario del equipo (ARC-60), y edición/borrado desde P3
// (ARC-61) y P1 (ARC-70). El resto de F5 (marcar como hecho, filtros, pestaña
// "Próximas"...) queda fuera de este alcance — ver ARC-62, ARC-63, ARC-65.
//
// Reglas de negocio:
// - Visibilidad total entre los 3 miembros de la oficina: ni `clients.get` ni
//   `clients.list` aplican control de acceso por usuario (PRD de ARC-16) y
//   este archivo mantiene la misma invariante. Se sostiene porque
//   convex/auth.ts bloquea el registro (`signUp`) y convex/seed.ts crea solo
//   las 3 cuentas: estar autenticado equivale a ser de la oficina. Si se abre
//   el registro o se segmenta por cliente/equipo, la autorización tiene que
//   pasar a `get`, `update` y `remove`.
// - `update` es "última escritura gana": Convex serializa las mutations (no
//   hay corrupción), pero una edición puede pisar otra hecha entre la carga
//   y el guardado. Añadir control optimista (`updatedAt`/`revision`) exigiría
//   cambiar el schema; se hará si el uso real muestra pisadas.
// - `remove` es idempotente: borrar algo que ya no existe es éxito.

const NOTE_MAX_LENGTH = 500;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

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

// `Date`/`Date.UTC` normalizan en vez de lanzar (ej. "2026-02-30" pasa a
// marzo), así que la única forma de detectar una fecha de calendario
// imposible es reconstruirla y comparar los componentes UTC contra los del
// string original.
function isValidISODate(value: string) {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, yStr, mStr, dStr] = match;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
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
    if (reminder.date !== args.expectedDate) {
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
