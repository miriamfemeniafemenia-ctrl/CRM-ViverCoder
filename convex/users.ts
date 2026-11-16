import { query } from "./_generated/server";
import { getTeamUser, isTeamUser } from "./lib/team";

// Los 3 usuarios del equipo (Miriam, Mónica, Antonio) — usado por selectores
// de asignación como el de "Nuevo recordatorio" (ARC-60) y el de agente
// asignado del cliente (ARC-49). Requiere un usuario del equipo, igual que el
// resto de funciones públicas del proyecto (convex/lib/team.ts). Proyecta solo
// lo que necesita un selector (id + nombre) en vez de exponer el documento
// completo (email, teléfono, timestamps de verificación, rol) al cliente.
// Filtra con la misma regla que `assertAssignableUser`, para que el selector no
// ofrezca a nadie que el servidor luego rechace.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getTeamUser(ctx);
    if (user === null) {
      return [];
    }
    const users = await ctx.db.query("users").collect();
    return users.filter((u) => isTeamUser(u)).map((u) => ({ _id: u._id, name: u.name }));
  },
});

// Usuario conectado (name, email, role) — base para el shell de navegación
// (ARC-8) y para cualquier función futura que necesite saber quién está
// autenticado. Sigue el principio de seguridad del proyecto: toda función
// pública que toque datos debe validar la sesión, no solo confiar en que
// la ruta esté protegida por src/proxy.ts.
export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await getTeamUser(ctx);
    if (user === null) {
      return null;
    }
    return user;
  },
});
