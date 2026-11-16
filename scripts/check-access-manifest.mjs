#!/usr/bin/env node
// Comprueba el manifiesto de acceso (ARC-49). Ver scripts/access-check.mjs.
//
// Uso:
//   A) despliegue frente a manifiesto (nunca contra el manifiesto de una
//      versión que aún no está desplegada en ese entorno):
//      npx convex function-spec [--prod] > spec.json
//      node scripts/check-access-manifest.mjs --spec spec.json --manifest-ref <SHA desplegado>
//      node scripts/check-access-manifest.mjs --spec spec.json --manifest convex/access-manifest.json
//   B) código del árbol de trabajo frente a su manifiesto (AST):
//      node scripts/check-access-manifest.mjs --source [--manifest convex/access-manifest.json]
//
// Sale con código 1 si hay cualquier error.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkSourceAgainstManifest, checkSpecAgainstManifest } from "./access-check.mjs";
import { collectConvexSources } from "./convex-sources.mjs";

const args = process.argv.slice(2);
const value = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

const manifestRef = value("--manifest-ref");
const manifestPath = value("--manifest") ?? "convex/access-manifest.json";
const specPath = value("--spec");
const source = args.includes("--source");

if (!specPath && !source) {
  console.error("Indica --spec <archivo> y/o --source. Ver el comentario de cabecera.");
  process.exit(2);
}

const manifestText = manifestRef
  ? execFileSync("git", ["show", `${manifestRef}:convex/access-manifest.json`], { encoding: "utf8" })
  : readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestText);
console.log(`Manifiesto: ${manifestRef ? `git ${manifestRef}` : manifestPath}`);

let failed = false;
const report = (title, errors) => {
  if (errors.length === 0) {
    console.log(`OK  ${title}`);
  } else {
    failed = true;
    console.log(`ERROR  ${title}`);
    for (const e of errors) console.log(`  - ${e}`);
  }
};

if (specPath) {
  // `function-spec` puede imprimir avisos antes del JSON: se toma desde la
  // primera llave.
  const raw = readFileSync(specPath, "utf8");
  const spec = JSON.parse(raw.slice(raw.indexOf("{")));
  report(`A) ${specPath} frente al manifiesto`, checkSpecAgainstManifest(spec, manifest));
}

if (source) {
  const files = collectConvexSources("convex");
  report(`B) código de convex/ frente al manifiesto (${files.length} archivos)`, checkSourceAgainstManifest(files, manifest));
}

process.exit(failed ? 1 : 0);
