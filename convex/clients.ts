import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertClientReferences,
  CLIENT_ERRORS,
  clientFields,
  insertClient,
  normalizeClientFields,
  normalizePostalCode,
} from "./lib/clientInput";
import { getTeamUser, requireTeamUser } from "./lib/team";

// D1 — Cliente. Alta (ARC-10/P4, ampliada en ARC-49), edición con control de
// ediciones simultáneas (ARC-11), sugerencias de población por código postal
// (ARC-66) y listado con buscador (ARC-9/P2). La prioridad se elige al crear y
// se cambia al editar (ARC-32); el estado de venta no se edita aquí.
// Las reglas de los campos viven en lib/clientInput.ts (compartidas con el alta
// inline de "Anotar interacción", ARC-72). Acceso: cartera compartida del
// equipo, guards de lib/team.ts como primera sentencia de cada handler.

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

// Los argumentos amplían los del alta original de forma retrocompatible: los
// campos que ya existían mantienen nombre, tipo y obligatoriedad.
export const create = mutation({
  args: clientFields,
  handler: async (ctx, args) => {
    await requireTeamUser(ctx);
    return await insertClient(ctx, args);
  },
});

// Edición de cliente (P4 editar, ARC-11). Sustituye TODOS los campos
// editables: el que llega vacío se borra. No toca `saleStatus` ni `createdAt`.
// La prioridad (ARC-32) es obligatoria en el documento: si llega se guarda, y
// si no llega (p. ej. una pestaña con la versión anterior de la app) se
// conserva la actual; nunca se borra.
//
// Control optimista: `expectedVersion` es la versión con la que se abrió el
// formulario (`updatedAt ?? createdAt`). Si ya no coincide, otra persona guardó
// antes y se rechaza en vez de pisar sus cambios. La comprobación y el patch van
// en la misma mutation, así que son atómicos. La versión siempre sube
// (max(ahora, anterior + 1)). Cubre las mutations de la aplicación; las
// escrituras directas siguen el procedimiento del README.
export const update = mutation({
  args: { id: v.id("clients"), expectedVersion: v.number(), ...clientFields },
  handler: async (ctx, args) => {
    await requireTeamUser(ctx);
    const { id, expectedVersion, priority, ...input } = args;
    const client = await ctx.db.get(id);
    if (!client) {
      throw new ConvexError(CLIENT_ERRORS.notFound);
    }
    const currentVersion = client.updatedAt ?? client.createdAt;
    if (expectedVersion !== currentVersion) {
      throw new ConvexError(CLIENT_ERRORS.editConflict);
    }
    const fields = normalizeClientFields(input);
    await assertClientReferences(ctx, fields, id);
    // `patch` con `undefined` borra el campo: así se vacían los que llegan vacíos.
    // La prioridad NO sigue esa regla: sin valor se omite del patch para no
    // borrar un campo obligatorio.
    await ctx.db.patch(id, {
      ...fields,
      ...(priority === undefined ? {} : { priority }),
      updatedAt: Math.max(Date.now(), currentVersion + 1),
    });
  },
});

const CITIES_SCAN_LIMIT = 50;
const CITIES_MAX_RESULTS = 10;

// Sugerencias de población para un código postal (ARC-66, «aprender de la
// cartera»): las poblaciones que ya se usaron con ese código en otros
// clientes. Devuelve SOLO nombres de población distintos (nunca clientes) y el
// código normalizado al que corresponden, para que la interfaz descarte
// respuestas de un código anterior. Es una sugerencia, no una lista
// exhaustiva: recorre como mucho CITIES_SCAN_LIMIT clientes.
export const citiesForPostalCode = query({
  args: { postalCode: v.string() },
  returns: v.object({
    postalCode: v.union(v.string(), v.null()),
    cities: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getTeamUser(ctx);
    if (user === null) {
      return { postalCode: null, cities: [] };
    }
    const postalCode = normalizePostalCode(args.postalCode);
    if (postalCode === null) {
      return { postalCode: null, cities: [] };
    }
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_postalCode", (q) => q.eq("address.postalCode", postalCode))
      .take(CITIES_SCAN_LIMIT);
    const cities = new Set<string>();
    for (const c of clients) {
      const city = c.address?.city?.trim();
      if (city) cities.add(city);
    }
    return {
      postalCode,
      cities: [...cities].sort((a, b) => a.localeCompare(b, "es")).slice(0, CITIES_MAX_RESULTS),
    };
  },
});

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getTeamUser(ctx);
    if (user === null) {
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
    const user = await getTeamUser(ctx);
    if (user === null) {
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
    const user = await getTeamUser(ctx);
    if (user === null) {
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
    const user = await getTeamUser(ctx);
    if (user === null) {
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
