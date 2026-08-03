"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  if (process.env.NODE_ENV === "production") {
    // Con autenticación real de por medio, un placeholder oculta una mala
    // configuración hasta un fallo confuso dentro del login — mejor que el
    // build/deploy de producción (Railway) falle aquí mismo.
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL no está definida. Configúrala en las variables de entorno de Railway antes de desplegar.",
    );
  }
  if (typeof window !== "undefined") {
    // Solo en el navegador (no durante el prerender de `next build` en
    // desarrollo, que se evalúa antes de que exista .env.local).
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL no está definida — copia .env.example a .env.local y ejecuta `npx convex dev`.",
    );
  }
}

// Fallback sintácticamente válido solo para que el prerender de desarrollo
// no rompa el build; en producción y en el navegador ya se lanzó arriba.
const convex = new ConvexReactClient(convexUrl || "https://placeholder.convex.cloud");

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>{children}</ConvexAuthNextjsProvider>
  );
}
