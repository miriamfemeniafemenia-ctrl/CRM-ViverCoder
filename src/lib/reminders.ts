import { ConvexError } from "convex/values";

export const NOTE_MAX_LENGTH = 500;

// Textos exactos con los que convex/reminders.ts lanza ConvexError. Si se
// añade o cambia uno allí, tocarlo aquí: el formulario y ReminderItem solo
// muestran mensajes de esta lista y el resto cae en un mensaje genérico.
const KNOWN_SERVER_ERRORS = new Set([
  "La nota es obligatoria",
  `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`,
  "La fecha no es válida",
  "La fecha de seguimiento no puede ser anterior a hoy",
  "El cliente no existe",
  "El usuario asignado no existe",
  "El recordatorio no existe",
  "El recordatorio ya está atendido",
]);

export function reminderErrorMessage(err: unknown, fallback: string) {
  const data = err instanceof ConvexError ? err.data : undefined;
  return typeof data === "string" && KNOWN_SERVER_ERRORS.has(data)
    ? data
    : fallback;
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
