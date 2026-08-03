import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Mirrors the data model in the CRM-PRD (Notion) — D1 to D5 — plus a
 * `users` table for the 3 fixed accounts (ARC-7, reopened), extending
 * Convex Auth's `authTables`.
 * Keep field names/shapes in sync with that document when it changes.
 */
export default defineSchema({
  ...authTables,
  // Fixed team accounts — Miriam, Mónica, Antonio. No self-registration (ARC-7).
  // `email`/`phone` index names and the optional verification-time fields
  // mirror @convex-dev/auth's own `authTables.users` shape (confirmed by
  // reading its source) so any internal account-linking lookups that query
  // those exact index names keep working.
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("agent")),
    phone: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phoneVerificationTime: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // D1 — Cliente: the central record everything else points to.
  clients: defineTable({
    name: v.string(),
    phone: v.string(),
    secondPhone: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    email: v.optional(v.string()),
    channel: v.union(
      v.literal("llamada"),
      v.literal("whatsapp"),
      v.literal("web"),
      v.literal("redes"),
      v.literal("presencial"),
    ),
    saleStatus: v.union(
      v.literal("interesado"),
      v.literal("presupuesto"),
      v.literal("cerrado"),
      v.literal("perdido"),
    ),
    priority: v.union(v.literal("alta"), v.literal("media"), v.literal("baja")),
    dni: v.optional(v.string()),
    birthDate: v.optional(v.string()), // ISO date
    sex: v.optional(v.string()),
    language: v.optional(v.union(v.literal("castellano"), v.literal("valenciano"))),
    address: v.optional(
      v.object({
        street: v.string(),
        number: v.string(),
        floorDoor: v.optional(v.string()),
        postalCode: v.string(),
        city: v.string(),
        province: v.string(),
      }),
    ),
    referredBy: v.optional(v.string()),
    assignedAgentId: v.optional(v.id("users")),
    createdAt: v.number(), // Date.now()
  })
    .index("by_saleStatus", ["saleStatus"])
    .index("by_assignedAgent", ["assignedAgentId"]),

  // D2 — Contacto: one entry per call/WhatsApp/email/etc. Feeds the client's history.
  contacts: defineTable({
    clientId: v.id("clients"),
    type: v.union(
      v.literal("llamada"),
      v.literal("whatsapp"),
      v.literal("correo"),
      v.literal("redes"),
      v.literal("web"),
    ),
    note: v.string(),
    createdById: v.id("users"),
    createdAt: v.number(),
  }).index("by_client", ["clientId"]),

  // D3 — Recordatorio: what powers P1 "Mis tareas de hoy".
  reminders: defineTable({
    clientId: v.id("clients"),
    date: v.string(), // ISO date, the day the follow-up is due
    note: v.string(),
    status: v.union(v.literal("pendiente"), v.literal("atendido")),
    createdById: v.id("users"),
    assignedToId: v.id("users"),
  })
    .index("by_client", ["clientId"])
    .index("by_assignedTo_status", ["assignedToId", "status"]),

  // D4 — Siniestro: a claim linked to a client, with its own affected-party list
  // and its own follow-up-notes thread (Mejora 4).
  claims: defineTable({
    clientId: v.id("clients"),
    type: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("abierto"),
      v.literal("en_tramitacion"),
      v.literal("resuelto"),
    ),
    openedAt: v.number(),
    affectedParties: v.array(
      v.object({
        name: v.string(),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
      }),
    ),
    followUpNotes: v.array(
      v.object({
        date: v.number(),
        authorId: v.id("users"),
        note: v.string(),
      }),
    ),
  })
    .index("by_client", ["clientId"])
    .index("by_status", ["status"]),

  // D5 — Póliza (Mejora 3 / F3): insurance policies held by a client.
  policies: defineTable({
    clientId: v.id("clients"),
    type: v.string(),
    insurer: v.string(),
    policyNumber: v.string(),
    status: v.union(
      v.literal("activa"),
      v.literal("reemplazada"),
      v.literal("anulada"),
    ),
    createdAt: v.number(),
  }).index("by_client", ["clientId"]),
});
