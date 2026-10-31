// Navegación P1 → P3 (ARC-64). P3 recuerda desde dónde se abrió con `?from=` y,
// cuando se llega desde P1 con un cliente elegido en el filtro, con
// `?vista=recordatorios` para mostrar los recordatorios arriba.
//
// Los parámetros de URL no son de fiar: Next los entrega como `string`,
// `string[]` (parámetro repetido) o `undefined`, y cualquier valor desconocido
// cae en el destino por defecto.
type Param = string | string[] | undefined;

const DEFAULT_BACK = { href: "/clientes", label: "← Clientes" };

// `Map`, no un objeto indexado: con un objeto, `from=constructor` o
// `from=__proto__` devolvía una propiedad del prototipo, no un destino.
const BACK_BY_ORIGIN = new Map([
  ["p1", { href: "/", label: "← Mis tareas" }],
  ["p2", DEFAULT_BACK],
]);

export function clientPageContext(from: Param, vista: Param) {
  const origin = typeof from === "string" ? from : undefined;
  const back = (origin !== undefined && BACK_BY_ORIGIN.get(origin)) || DEFAULT_BACK;
  return {
    backHref: back.href,
    backLabel: back.label,
    focusReminders: origin === "p1" && vista === "recordatorios",
  };
}

// Enlace de P1 a la ficha del cliente. `filtered`: hay un cliente elegido en el
// filtro de P1, así que la ficha se abre con Recordatorios destacado.
export function clientPageHref(clientId: string, { filtered }: { filtered: boolean }) {
  const base = `/clientes/${encodeURIComponent(clientId)}?from=p1`;
  return filtered ? `${base}&vista=recordatorios` : base;
}
