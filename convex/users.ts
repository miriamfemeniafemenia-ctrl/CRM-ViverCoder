import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

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
