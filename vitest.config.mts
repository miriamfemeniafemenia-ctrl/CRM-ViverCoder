import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Dos proyectos (ARC-78):
// - `server`: Convex (convex-test necesita edge-runtime), funciones puras de
//   `src/lib` y scripts. Es la configuración de siempre.
// - `ui`: componentes y páginas React en jsdom, con Testing Library. Ver
//   `src/test/setup.ts` (polyfill de <dialog>, limpieza y mock de Convex).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          include: [
            "convex/**/*.test.ts",
            "src/lib/**/*.test.ts",
            "scripts/**/*.test.mjs",
          ],
        },
      },
      {
        resolve: {
          alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
