import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

// D3 — Recordatorio. Alta desde la sub-pantalla "Nuevo recordatorio" (ARC-15)
// con asignación a un usuario del equipo (ARC-60). El resto de F5 (editar,
// marcar como hecho, filtros, pestaña "Próximas"...) queda fuera de este
// alcance — ver ARC-61, ARC-62, ARC-63, ARC-65.
//
// Sin scoping por cliente/usuario a propósito: ni `clients.get` ni
// `clients.list` aplican ningún control de acceso por usuario hoy (CRM de
// oficina de 3 personas con visibilidad total, documentado en el PRD de
// ARC-16). Este archivo mantiene la misma invariante en vez de introducir un
// aislamiento que no existe en ningún otro sitio del proyecto.

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
