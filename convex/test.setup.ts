/// <reference types="vite/client" />

// Módulos que `convexTest` registra como funciones Convex. Se excluyen los
// tests y este mismo archivo para que no se carguen como si fueran funciones
// del backend. (El patrón `!(*.*.*)*.*s` de la doc de convex-test no coincide
// con nada en este vitest/vite, devuelve {} — por eso patrones negativos.)
export const modules = import.meta.glob([
  "./**/*.*s",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
  "!./test.setup.ts",
]);
