/**
 * Shared domain types, mirroring convex/schema.ts (D1-D5 from the CRM-PRD).
 * Prefer importing generated types from `convex/_generated/dataModel` for
 * anything that touches the database directly — these are for UI-only
 * shapes (form state, props) that don't need a Convex Id.
 */

export type SaleStatus = "interesado" | "presupuesto" | "cerrado" | "perdido";

export type Priority = "alta" | "media" | "baja";

export type ContactChannel = "llamada" | "whatsapp" | "correo" | "redes" | "web";

export type ClientChannel = "llamada" | "whatsapp" | "web" | "redes" | "presencial";

export type ClaimStatus = "abierto" | "en_tramitacion" | "resuelto";

export type PolicyStatus = "activa" | "reemplazada" | "anulada";

export type ReminderStatus = "pendiente" | "atendido";

export type UserRole = "owner" | "agent";
