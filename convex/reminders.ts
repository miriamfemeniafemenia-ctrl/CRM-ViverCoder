import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// D3 — Recordatorio. Alta desde la sub-pantalla "Nuevo recordatorio" (ARC-15)
// con asignación a un usuario del equipo (ARC-60), y edición/borrado desde P1
// y P3 (ARC-61). El resto de F5 (marcar como hecho, filtros, pestaña
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

// Duplicada (con la misma lógica) en la página del formulario: Convex solo
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
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
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
    const note = args.note.trim();
    if (!note) {
      throw new ConvexError("La nota es obligatoria");
    }
    if (note.length > NOTE_MAX_LENGTH) {
      throw new ConvexError(
        `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`,
      );
    }
    if (!isValidISODate(args.date)) {
      throw new ConvexError("La fecha no es válida");
    }
    if (args.date < todayISODateMadrid()) {
      throw new ConvexError("La fecha de seguimiento no puede ser anterior a hoy");
    }
    const client = await ctx.db.get(args.clientId);
    if (!client) {
      throw new ConvexError("El cliente no existe");
    }
    const assignee = await ctx.db.get(args.assignedToId);
    if (!assignee) {
      throw new ConvexError("El usuario asignado no existe");
    }
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

export const get = query({
  args: { id: v.id("reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("reminders"),
    date: v.string(),
    note: v.string(),
    assignedToId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    const note = args.note.trim();
    if (!note) {
      throw new ConvexError("La nota es obligatoria");
    }
    if (note.length > NOTE_MAX_LENGTH) {
      throw new ConvexError(
        `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`,
      );
    }
    if (!isValidISODate(args.date)) {
      throw new ConvexError("La fecha no es válida");
    }
    const reminder = await ctx.db.get(args.id);
    if (!reminder) {
      throw new ConvexError("El recordatorio no existe");
    }
    // Un recordatorio vencido se puede editar sin obligar a cambiar su fecha:
    // solo una fecha nueva tiene que ser de hoy en adelante.
    if (args.date !== reminder.date && args.date < todayISODateMadrid()) {
      throw new ConvexError("La fecha de seguimiento no puede ser anterior a hoy");
    }
    const assignee = await ctx.db.get(args.assignedToId);
    if (!assignee) {
      throw new ConvexError("El usuario asignado no existe");
    }
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
    await ctx.db.delete(args.id);
  },
});

// P1 — recordatorios pendientes de quien está conectado, con el nombre del
// cliente. Volumen esperado: unas decenas de pendientes por usuario (3
// usuarios); cada carga lee y ordena por fecha todos los suyos. Si crece, añadir
// el índice ["assignedToId", "status", "date"] y paginar.
export const listPendingByAssignee = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
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
      .sort((a, b) => a.date.localeCompare(b.date));
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
