import { ConvexError } from "convex/values";

export const NOTE_MAX_LENGTH = 500;

// Todo `ConvexError` de texto lanzado por convex/reminders.ts está redactado
// para el usuario, así que se muestra tal cual; cualquier otro error (red,
// "No autenticado", fallos inesperados) cae en el mensaje genérico.
export function reminderErrorMessage(err: unknown, fallback: string) {
  const data = err instanceof ConvexError ? err.data : undefined;
  return typeof data === "string" ? data : fallback;
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
