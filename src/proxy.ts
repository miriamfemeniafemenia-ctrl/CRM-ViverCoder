import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Next.js 16 renombró `middleware.ts` a `proxy.ts` (runtime Node.js por
// defecto, no configurable a Edge). El export debe llamarse `proxy` o ser
// el export default — usamos default aquí.
const isPublicRoute = createRouteMatcher(["/login"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authenticated = await convexAuth.isAuthenticated();
  if (!isPublicRoute(request) && !authenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
  if (isPublicRoute(request) && authenticated) {
    return nextjsMiddlewareRedirect(request, "/");
  }
});

export const config = {
  // Deja pasar estáticos/assets sin pasar por el proxy. `/api/auth` NO se
  // excluye a propósito: convexAuthNextjsMiddleware intercepta esa ruta
  // internamente para hacer proxy de signIn/signOut hacia Convex, antes de
  // que se llame al handler de arriba — si se excluyera, el login dejaría
  // de funcionar (verificado leyendo @convex-dev/auth@0.0.94).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
