import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { addressValidator } from "./lib/addressFields";
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

  // ARC-75 — Registro de auditoría de restablecimientos de contraseña
  // (convex/adminAuth.ts). Sin query/mutation pública: solo funciones internas
  // lo escriben. Nunca guarda contraseña, hash, token, valor de variable ni
  // email (el `userId` basta). `executor` no identifica a la persona: la CLI de
  // Convex no lleva identidad. Los obligatorios llevan valor al insertar
  // `iniciado`; los opcionales lo son a propósito y solo se rellenan al cerrar.
  // `cambio_no_confirmado` es el estado ambiguo de un `modifyPassword` que lanzó:
  // no afirma que la contraseña cambiara ni que no.
  passwordResetAudit: defineTable({
    requestId: v.string(),
    userId: v.id("users"),
    startedAt: v.number(),
    status: v.union(
      v.literal("iniciado"),
      v.literal("fallo_preparacion"),
      v.literal("contrasena_cambiada"),
      v.literal("cambio_no_confirmado"),
      v.literal("completado"),
      v.literal("fallo_invalidacion"),
      v.literal("inconcluso_supersedido"),
    ),
    executor: v.string(),
    // La función programada que hace el trabajo: su estado (lo escribe la
    // plataforma) dice si la ejecución sigue viva, sin depender de este registro.
    programadoId: v.id("_scheduled_functions"),
    finishedAt: v.optional(v.number()),
    // Sesiones observadas antes y que ya no existían al verificar; NO prueba que
    // esta acción las invalidara. Solo se escribe tras una verificación completa a
    // cero: ausente = no se verificó (sin valor por defecto 0).
    sessionsAbsentAfterCheck: v.optional(v.number()),
    // Sesiones + refresh tokens que seguían vivos (si se pudo contar).
    sessionsRemaining: v.optional(v.number()),
    supersededBy: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_requestId", ["requestId"]),

  // D1 — Cliente: the central record everything else points to.
  clients: defineTable({
    name: v.string(),
    phone: v.optional(v.string()),
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
    // Contrato único en lib/addressFields.ts: los 6 subcampos opcionales.
    address: v.optional(addressValidator),
    referredBy: v.optional(v.string()),
    assignedAgentId: v.optional(v.id("users")),
    createdAt: v.number(), // Date.now()
    // Versión del cliente para el control de ediciones simultáneas (ARC-11):
    // toda mutation que modifique campos editables debe actualizarlo con
    // max(Date.now(), versión anterior + 1). Ausente en clientes anteriores a
    // ARC-49: su versión es `createdAt`. Las escrituras directas (panel,
    // import, scripts) siguen el procedimiento del README.
    updatedAt: v.optional(v.number()),
  })
    .index("by_saleStatus", ["saleStatus"])
    .index("by_assignedAgent", ["assignedAgentId"])
    .index("by_createdAt", ["createdAt"])
    // Sugerencias de población por código postal (ARC-66).
    .index("by_postalCode", ["address.postalCode"])
    // Índice para la comprobación de unicidad del DNI/NIE que hacen las
    // mutations (ARC-49). Un índice de Convex no impone unicidad por sí solo.
    .index("by_dni", ["dni"]),

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
    // Cuándo ocurrió la interacción (ISO, la elige quien la anota; cualquier
    // fecha) — ARC-72. `createdAt` es cuándo se registró.
    date: v.string(),
    // Quién la realizó (seleccionable) frente a quién la registró (`createdById`,
    // siempre la sesión activa).
    performedById: v.id("users"),
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
    status: v.union(v.literal("activa"), v.literal("reemplazada"), v.literal("anulada")),
    createdAt: v.number(),
  }).index("by_client", ["clientId"]),
});
