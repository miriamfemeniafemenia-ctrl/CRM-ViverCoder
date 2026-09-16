import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

// Los 3 usuarios del equipo (Miriam, Mónica, Antonio) — usado por selectores
// de asignación como el de "Nuevo recordatorio" (ARC-60). Requiere sesión,
// igual que el resto de funciones públicas del proyecto. Proyecta solo lo
// que necesita un selector (id + nombre) en vez de exponer el documento
// completo (email, teléfono, timestamps de verificación, rol) al cliente.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ _id: u._id, name: u.name }));
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
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});
