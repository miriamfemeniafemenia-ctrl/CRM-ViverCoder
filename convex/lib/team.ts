import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

// Política de acceso a datos (ARC-49, decisión de Miriam): UNA SOLA CARTERA
// COMPARTIDA. Cualquier usuario del equipo (rol `owner` o `agent`) puede ver y
// editar cualquier cliente, contacto o recordatorio y asignarlo a cualquier
// otro usuario del equipo. No hay segmentación por agente ni por cartera; si
// algún día la hay, será un ticket propio que revise TODAS las funciones de
// convex/access-manifest.json.
//
// Toda función pública que lea o escriba datos de clientes, contactos,
// recordatorios o usuarios empieza con uno de estos guards, como PRIMERA
// sentencia del handler (lo comprueba scripts/check-access-manifest.mjs):
// - queries: `const user = await getTeamUser(ctx);` seguido de
//   `if (user === null) return <vacío>;` (convención del proyecto: sin sesión
//   las queries devuelven vacío sin leer datos).
// - mutations: `const user = await requireTeamUser(ctx);` (lanza).
//
// "Usuario del equipo" = sesión válida cuyo usuario existe y tiene un rol del
// equipo. Hoy el schema de `users` solo admite esos dos roles y no hay alta
// pública (convex/auth.ts), así que equivale a "sesión de una de las 3
// cuentas"; la regla queda aquí, en un único sitio, por si eso cambia (por
// ejemplo, un estado «desactivado»).

const TEAM_ROLES: ReadonlySet<string> = new Set(["owner", "agent"]);

export function isTeamUser(user: Doc<"users"> | null): user is Doc<"users"> {
  return user !== null && TEAM_ROLES.has(user.role);
}

export async function getTeamUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  const user = await ctx.db.get(userId);
  return isTeamUser(user) ? user : null;
}

export async function requireTeamUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getTeamUser(ctx);
  if (user === null) {
    throw new Error("No autenticado");
  }
  return user;
}

// Agente asignable a un cliente: la misma regla que el selector (`users.list`).
export const ASSIGNABLE_AGENT_ERROR = "El agente asignado no es válido";

export async function assertAssignableUser(ctx: QueryCtx, userId: Id<"users">) {
  if (!isTeamUser(await ctx.db.get(userId))) {
    throw new ConvexError(ASSIGNABLE_AGENT_ERROR);
  }
}
