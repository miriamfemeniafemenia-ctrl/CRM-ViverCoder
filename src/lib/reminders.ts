import { ConvexError } from "convex/values";

export const NOTE_MAX_LENGTH = 500;

// Los errores pensados para el usuario llegan como `ConvexError({ userMessage })`
// (ver `userError` en convex/reminders.ts) y se muestran tal cual. Cualquier
// otro (red, "No autenticado", fallos inesperados) cae en el mensaje genérico.
export function reminderErrorMessage(err: unknown, fallback: string) {
  const data: unknown = err instanceof ConvexError ? err.data : undefined;
  if (typeof data === "object" && data !== null && "userMessage" in data) {
    const { userMessage } = data;
    if (typeof userMessage === "string") return userMessage;
  }
  return fallback;
}

// Duplicada (con la misma lógica) en convex/reminders.ts: Convex solo
// empaqueta `convex/`, Next.js solo empaqueta `src/`, no comparten build.
// Si se toca una, tocar la otra.
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
