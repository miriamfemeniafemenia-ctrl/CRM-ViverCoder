import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// D1 — Cliente. Alta básica (ARC-10/P4) y listado con buscador (ARC-9/P2).
// Los campos ampliados de D1 (DNI, dirección, prioridad, agente asignado...)
// quedan fuera de este alcance — ver ARC-48/ARC-31/ARC-49.

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    channel: v.union(
      v.literal("llamada"),
      v.literal("whatsapp"),
      v.literal("web"),
      v.literal("redes"),
      v.literal("presencial"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("No autenticado");
    }
    const name = args.name.trim();
    const phone = args.phone?.trim() || undefined;
    const email = args.email?.trim() || undefined;
    if (!name) {
      throw new Error("El nombre completo es obligatorio");
    }
    if (!phone && !email) {
      throw new Error("Introduce al menos un teléfono o un correo electrónico");
    }
    return await ctx.db.insert("clients", {
      name,
      phone,
      email,
      channel: args.channel,
      saleStatus: "interesado",
      priority: "media",
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const all = await ctx.db.query("clients").withIndex("by_createdAt").order("desc").collect();
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
