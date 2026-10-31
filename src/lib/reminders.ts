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

// Separa los recordatorios en «Hoy» (vencidos y de hoy) y «Próximas» (futuros).
// Las fechas son ISO `YYYY-MM-DD`, así que la comparación de cadenas es la de
// fechas. No ordena ni muta: conserva el orden de entrada (la query ya los
// devuelve por fecha y `_id`).
export function splitRemindersByToday<T extends { date: string }>(items: readonly T[], today: string) {
  const dueOrToday: T[] = [];
  const upcoming: T[] = [];
  for (const item of items) {
    (item.date <= today ? dueOrToday : upcoming).push(item);
  }
  return { dueOrToday, upcoming };
}

// Agrupa por fecha, con las fechas en orden ascendente (no depende del orden de
// entrada) y, dentro de cada fecha, en el orden de entrada. No muta la entrada.
export function groupByDate<T extends { date: string }>(items: readonly T[]) {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const group = byDate.get(item.date);
    if (group) group.push(item);
    else byDate.set(item.date, [item]);
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => ({ date, items: byDate.get(date) as T[] }));
}

// «lunes, 2 de noviembre de 2026» a partir de `YYYY-MM-DD`. Se construye y se
// formatea en UTC para que la zona horaria del navegador no desplace el día.
export function formatLongDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

// Milisegundos hasta las 00:00 siguientes en Europe/Madrid (mínimo 1). El
// cambio de hora cae a las 02:00/03:00, no a medianoche; aun así quien lo use
// debe recalcular al dispararse el temporizador, no confiar en esta cifra.
export function msUntilNextMadridMidnight(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = part("hour");
  const minute = part("minute");
  const second = part("second");
  if ([hour, minute, second].some(Number.isNaN)) {
    throw new Error("No se pudo calcular la hora actual (Europe/Madrid)");
  }
  const remaining =
    ((23 - hour) * 3600 + (59 - minute) * 60 + (59 - second)) * 1000 + (1000 - now.getMilliseconds());
  return Math.max(1, remaining);
}

type VisibilitySource = {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

// Avisa con `onChange` en cada medianoche de Madrid y cuando la pestaña vuelve
// a estar visible (los temporizadores se retrasan con el equipo en reposo). El
// temporizador se rearma tras cada disparo y se ignoran los eventos de
// visibilidad mientras siga oculta. Devuelve la función que lo cancela todo.
// Sin React, para poder probarlo con temporizadores falsos.
export function watchMadridDay(
  onChange: () => void,
  doc: VisibilitySource | undefined = typeof document === "undefined" ? undefined : document,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      onChange();
      arm();
    }, msUntilNextMadridMidnight(new Date()));
  };
  const onVisibilityChange = () => {
    if (doc?.visibilityState !== "visible") return;
    onChange();
    arm();
  };
  arm();
  doc?.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    clearTimeout(timeout);
    doc?.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
