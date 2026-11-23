import { type FunctionReference, getFunctionName } from "convex/server";
import { type Mock, vi } from "vitest";

// Mock de `convex/react` para las pruebas de componentes (ARC-78). Lo instala
// `setup.ts` con `vi.mock`; cada prueba configura sus respuestas con
// `setQuery` y `mockMutation`.
//
// Aislamiento: Vitest aísla los módulos por archivo de prueba, así que dos
// archivos (aunque corran en paralelo) no comparten este estado. Dentro de un
// archivo, `resetConvexMock()` corre antes y después de cada prueba
// (`setup.ts`): ninguna prueba ve respuestas ni spies de otra.

type AnyRef = FunctionReference<"query" | "mutation">;

const state = {
  queryResults: new Map<string, unknown>(),
  mutationSpies: new Map<string, Mock>(),
};

export function setQuery(ref: FunctionReference<"query">, value: unknown) {
  state.queryResults.set(getFunctionName(ref), value);
}

// Crea un spy nuevo para la mutación y lo devuelve para configurarlo y
// comprobar sus llamadas.
export function mockMutation(ref: FunctionReference<"mutation">): Mock {
  const spy = vi.fn();
  state.mutationSpies.set(getFunctionName(ref), spy);
  return spy;
}

export function resetConvexMock() {
  state.queryResults.clear();
  state.mutationSpies.clear();
}

// Sin respuesta configurada, `undefined`: lo mismo que «cargando».
export function useQueryMock(ref: AnyRef, args?: unknown): unknown {
  if (args === "skip") return undefined;
  return state.queryResults.get(getFunctionName(ref));
}

// Sin spy registrado, la mutación falla: una prueba no puede pasar llamando sin
// querer a una mutación que no ha simulado.
export function useMutationMock(ref: AnyRef) {
  const name = getFunctionName(ref);
  const spy = state.mutationSpies.get(name);
  if (spy) return spy;
  return () => Promise.reject(new Error(`mutación no simulada: ${name}`));
}
