// Reglas compartidas entre módulos Convex (recordatorios, contactos). Solo
// helpers: aquí no hay funciones públicas ni autorización — esa vive siempre
// en las mutations/queries que los llaman.
//
// Existe una copia de `NOTE_MAX_LENGTH` en src/lib/reminders.ts: Convex solo
// empaqueta `convex/`, Next.js solo `src/`, no comparten build. Si se toca
// una, tocar la otra.

export const NOTE_MAX_LENGTH = 500;

// Fecha de hoy en Europe/Madrid (`YYYY-MM-DD`). La usan recordatorios (fecha
// de seguimiento no anterior a hoy) y clientes (fecha de nacimiento no
// futura). Duplicada, con la misma lógica, en src/lib/reminders.ts: si se toca
// una, tocar la otra.
export function todayISODateMadrid() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("No se pudo calcular la fecha de hoy (Europe/Madrid)");
  }
  return `${year}-${month}-${day}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// `Date`/`Date.UTC` normalizan en vez de lanzar (ej. "2026-02-30" pasa a
// marzo), así que la única forma de detectar una fecha de calendario
// imposible es reconstruirla y comparar los componentes UTC contra los del
// string original.
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
