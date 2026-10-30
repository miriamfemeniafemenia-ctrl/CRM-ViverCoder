import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { clientChannelValidator, insertClient } from "./lib/clientInput";

// D1 — Cliente. Alta básica (ARC-10/P4) y listado con buscador (ARC-9/P2).
// Los campos ampliados de D1 (DNI, dirección, prioridad, agente asignado...)
// quedan fuera de este alcance — ver ARC-48/ARC-31/ARC-49.
// Las reglas del alta viven en lib/clientInput.ts (compartidas con el alta
// inline de "Anotar interacción", ARC-72).

const saleStatusValidator = v.union(
  v.literal("interesado"),
  v.literal("presupuesto"),
  v.literal("cerrado"),
  v.literal("perdido"),
);

// Proyección mínima para el selector de cliente de "Anotar interacción"
// (ARC-72): nada de email, DNI, dirección, etc.
const pickerClientValidator = v.object({
  _id: v.id("clients"),
  name: v.string(),
  phone: v.optional(v.string()),
  saleStatus: saleStatusValidator,
});

const PICKER_MIN_TERM = 2;
const PICKER_MAX_RESULTS = 10;
const PHONE_SEPARATORS_RE = /[\s\-.()]/g;

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    channel: clientChannelValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    return await insertClient(ctx, args);
  },
});

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const all = await ctx.db
      .query("clients")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    const term = args.search?.trim().toLowerCase();
    // Filtro por substring en memoria: Convex no soporta "contains" server-side
    // sin un search index, que cambiaría la semántica de búsqueda.
    return term
      ? all.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            (c.phone && c.phone.toLowerCase().includes(term)) ||
            (c.email && c.email.toLowerCase().includes(term)),
        )
      : all;
  },
});

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(args.id);
  },
});

// Selector de cliente de "Anotar interacción" (ARC-72). A diferencia de `list`
// (que devuelve la cartera entera con todos los campos) exige un término de
// al menos PICKER_MIN_TERM caracteres, devuelve como mucho PICKER_MAX_RESULTS
// filas y solo los campos de `pickerClientValidator`. Mismo criterio de
// coincidencia que `list` (substring en minúsculas, literal: sin normalizar
// acentos), más teléfono comparado sin espacios ni guiones.
// Límite honesto: `take` acota la respuesta, no el escaneo — Convex no tiene
// "contains" sin search index, así que se recorre `by_createdAt` hasta
// reunir 10 coincidencias. Con una cartera de oficina es asumible; si crece,
// añadir un search index.
// Sin sesión devuelve [] sin leer datos (convención de las queries del
// proyecto; las mutations sí lanzan).
export const searchForPicker = query({
  args: { term: v.string() },
  returns: v.array(pickerClientValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const term = args.term.trim().toLowerCase();
    if (term.length < PICKER_MIN_TERM) {
      return [];
    }
    const digitsTerm = term.replace(PHONE_SEPARATORS_RE, "");
    const results: Array<{
      _id: Id<"clients">;
      name: string;
      phone?: string;
      saleStatus: "interesado" | "presupuesto" | "cerrado" | "perdido";
    }> = [];
    for await (const c of ctx.db.query("clients").withIndex("by_createdAt").order("desc")) {
      const matches =
        c.name.toLowerCase().includes(term) ||
        (c.email?.toLowerCase().includes(term) ?? false) ||
        (c.phone
          ? c.phone.toLowerCase().includes(term) ||
            (digitsTerm.length >= PICKER_MIN_TERM &&
              c.phone.replace(PHONE_SEPARATORS_RE, "").includes(digitsTerm))
          : false);
      if (!matches) continue;
      results.push({ _id: c._id, name: c.name, phone: c.phone, saleStatus: c.saleStatus });
      if (results.length >= PICKER_MAX_RESULTS) break;
    }
    return results;
  },
});

// Cliente a partir de un id que llega de la URL (?clientId=). `get` usa
// `v.id("clients")`, que lanza ante un id malformado; este normaliza en el
// servidor y devuelve null para uno mal escrito, de otra tabla o inexistente
// (mismo patrón que `reminders.get`). Sin sesión devuelve null.
export const lookup = query({
  args: { id: v.string() },
  returns: v.union(pickerClientValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const id = ctx.db.normalizeId("clients", args.id);
    const client = id === null ? null : await ctx.db.get(id);
    if (!client) {
      return null;
    }
    return {
      _id: client._id,
      name: client.name,
      phone: client.phone,
      saleStatus: client.saleStatus,
    };
  },
});
