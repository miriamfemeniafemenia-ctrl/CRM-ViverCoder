// Archivos fuente de Convex para la comprobación B del manifiesto (ARC-49):
// TODOS los `.ts` bajo `convex/`, también en subcarpetas (un módulo
// `convex/sub/mod.ts` se publica como `sub/mod.js:función`), salvo
// `_generated/`, pruebas, declaraciones y `schema.ts`.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export function collectConvexSources(root = "convex") {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "_generated" && entry.name !== "node_modules") walk(path);
        continue;
      }
      const name = entry.name;
      if (!name.endsWith(".ts") || name.endsWith(".test.ts") || name.endsWith(".d.ts")) continue;
      const moduleName = relative(root, path).split(sep).join("/").replace(/\.ts$/, "");
      if (moduleName === "schema") continue;
      out.push({ module: moduleName, text: readFileSync(path, "utf8") });
    }
  };
  walk(root);
  return out;
}
