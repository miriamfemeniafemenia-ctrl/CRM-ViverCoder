// Presentación de los datos ampliados del cliente en la ficha P3 (ARC-50).
// Lógica pura, sin React.
//
// Los datos llegan ya normalizados por convex/lib/clientInput.ts, pero el
// formateo es defensivo (comprueba el tipo antes de `trim()`): un cambio
// directo en el panel de datos (ver README) podría dejar valores fuera del
// contrato, y la ficha no debe romperse ni mostrarlos como válidos.
import type { Id } from "../../convex/_generated/dataModel";
import { todayISODateMadrid } from "./reminders";

export const EMPTY = "—";
export const INVALID_DATE = "Fecha no válida";

// Fecha de nacimiento mínima: la misma que exige el servidor
// (normalizeClientFields en convex/lib/clientInput.ts).
const MIN_BIRTH_DATE = "1900-01-01";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Copia de `isValidISODate` de convex/lib/validation.ts: Convex solo empaqueta
// `convex/` y Next.js solo `src/`, no comparten build. SINCRONIZACIÓN: cualquier
// cambio en la validación de fechas del servidor obliga a revisar esta copia Y
// a ampliar los casos de la prueba de paridad (client-display.test.ts), que solo
// protege los casos que cubre.
export function isValidISODate(value: string) {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, yStr, mStr, dStr] = match;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// `YYYY-MM-DD` → `DD/MM/AAAA`, partiendo la cadena (sin `new Date`, para no
// desfasar el día por la zona horaria). Mismo rango que el servidor: de
// 1900-01-01 a hoy (Europe/Madrid).
export function formatBirthDate(
  value: unknown,
  today: string = todayISODateMadrid(),
): string {
  const v = text(value);
  if (!v) return EMPTY;
  if (!isValidISODate(v) || v < MIN_BIRTH_DATE || v > today) return INVALID_DATE;
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

// Dirección en hasta dos líneas: «calle número, piso/puerta» y
// «CP población (provincia)». Omite las partes vacías y sus separadores;
// `[]` si no queda nada.
// Recibe `Doc<"clients">["address"]`; el tipo es `unknown` para que la
// comprobación de tipos en ejecución sea real.
export function formatAddress(address: unknown): string[] {
  const a = (typeof address === "object" && address !== null ? address : {}) as Record<
    string,
    unknown
  >;
  const street = [text(a.street), text(a.number)].filter(Boolean).join(" ");
  const line1 = [street, text(a.floorDoor)].filter(Boolean).join(", ");
  const province = text(a.province);
  const line2 = [text(a.postalCode), text(a.city), province ? `(${province})` : ""]
    .filter(Boolean)
    .join(" ");
  return [line1, line2].filter(Boolean);
}

// Etiqueta de una opción (sexo, idioma). Un valor desconocido se muestra tal
// cual; vacío → guion.
export function optionLabel(
  options: readonly { value: string; label: string }[],
  value: unknown,
): string {
  const v = text(value);
  if (!v) return EMPTY;
  return options.find((o) => o.value === v)?.label ?? v;
}

export type AgentDisplay =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "known"; name: string }
  | { kind: "unknown" };

// Agente asignado: sin agente, lista de usuarios aún cargando, conocido, o id
// que ya no está entre los usuarios del equipo.
export function agentDisplay(
  agentId: Id<"users"> | undefined,
  users: readonly { _id: Id<"users">; name?: string }[] | undefined,
): AgentDisplay {
  if (!agentId) return { kind: "none" };
  if (users === undefined) return { kind: "loading" };
  const user = users.find((u) => u._id === agentId);
  const name = text(user?.name);
  return user && name ? { kind: "known", name } : { kind: "unknown" };
}
