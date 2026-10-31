// Pruebas de los helpers de P1 «Hoy» / «Próximas» (ARC-62). Fechas y horas
// fijas: ninguna depende del reloj ni de la zona horaria del proceso.
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  formatLongDate,
  groupByDate,
  msUntilNextMadridMidnight,
  splitRemindersByToday,
  watchMadridDay,
} from "./reminders";

const r = (date: string, id = date) => ({ date, id });

describe("splitRemindersByToday", () => {
  const today = "2026-11-02";

  test("ayer y hoy van a «Hoy»; mañana a «Próximas» (límites)", () => {
    const { dueOrToday, upcoming } = splitRemindersByToday(
      [r("2026-11-01"), r("2026-11-02"), r("2026-11-03")],
      today,
    );
    expect(dueOrToday.map((x) => x.date)).toEqual(["2026-11-01", "2026-11-02"]);
    expect(upcoming.map((x) => x.date)).toEqual(["2026-11-03"]);
  });

  test("la comparación de cadenas ISO respeta cambios de mes y de año", () => {
    expect(splitRemindersByToday([r("2026-09-30")], "2026-10-01").dueOrToday).toHaveLength(1);
    expect(splitRemindersByToday([r("2026-10-01")], "2026-09-30").upcoming).toHaveLength(1);
    expect(splitRemindersByToday([r("2026-12-31")], "2027-01-01").dueOrToday).toHaveLength(1);
    expect(splitRemindersByToday([r("2027-01-01")], "2026-12-31").upcoming).toHaveLength(1);
  });

  test("conserva el orden de entrada y las fechas repetidas", () => {
    const input = [r("2026-11-05", "a"), r("2026-11-03", "b"), r("2026-11-05", "c")];
    expect(splitRemindersByToday(input, today).upcoming.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  test("lista vacía", () => {
    expect(splitRemindersByToday([], today)).toEqual({ dueOrToday: [], upcoming: [] });
  });

  test("no muta la entrada", () => {
    const input = Object.freeze([Object.freeze(r("2026-11-01")), Object.freeze(r("2026-11-09"))]);
    expect(() => splitRemindersByToday(input, today)).not.toThrow();
  });
});

describe("groupByDate", () => {
  test("ordena las fechas de forma ascendente aunque la entrada venga desordenada", () => {
    const groups = groupByDate([
      r("2026-11-05", "a"),
      r("2026-11-02", "b"),
      r("2026-11-05", "c"),
      r("2026-11-03", "d"),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-05"]);
  });

  test("es estable dentro de cada fecha", () => {
    const groups = groupByDate([r("2026-11-05", "a"), r("2026-11-02", "b"), r("2026-11-05", "c")]);
    expect(groups.find((g) => g.date === "2026-11-05")?.items.map((x) => x.id)).toEqual(["a", "c"]);
  });

  test("un solo grupo con varias filas", () => {
    const groups = groupByDate([r("2026-11-05", "a"), r("2026-11-05", "b")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  test("vacío devuelve []", () => {
    expect(groupByDate([])).toEqual([]);
  });

  test("no muta la entrada", () => {
    const input = Object.freeze([Object.freeze(r("2026-11-05")), Object.freeze(r("2026-11-02"))]);
    expect(() => groupByDate(input)).not.toThrow();
    expect(input.map((x) => x.date)).toEqual(["2026-11-05", "2026-11-02"]);
  });
});

describe("formatLongDate", () => {
  test.each([
    ["2026-11-02", "lunes, 2 de noviembre de 2026"],
    ["2026-12-31", "jueves, 31 de diciembre de 2026"],
    ["2028-02-29", "martes, 29 de febrero de 2028"],
  ])("%s → %s (sin desplazar el día)", (iso, expected) => {
    expect(formatLongDate(iso)).toBe(expected);
  });
});

describe("msUntilNextMadridMidnight", () => {
  const H = 3_600_000;
  // Invierno (CET, UTC+1) y verano (CEST, UTC+2).
  test.each([
    ["invierno, 23:59:59.000", "2026-11-02T22:59:59.000Z", 1000],
    ["invierno, 00:00:00.000", "2026-11-01T23:00:00.000Z", 24 * H],
    ["invierno, 12:00:00.000", "2026-11-02T11:00:00.000Z", 12 * H],
    ["verano, 23:59:59.000", "2026-07-15T21:59:59.000Z", 1000],
    ["verano, 00:00:00.000", "2026-07-14T22:00:00.000Z", 24 * H],
    ["verano, 12:00:00.000", "2026-07-15T10:00:00.000Z", 12 * H],
    ["invierno, 23:59:59.999", "2026-11-02T22:59:59.999Z", 1],
  ])("%s → %d ms", (_name, iso, expected) => {
    expect(msUntilNextMadridMidnight(new Date(iso))).toBe(expected);
  });
});

describe("watchMadridDay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeDoc(state: "visible" | "hidden") {
    const listeners = new Set<() => void>();
    return {
      visibilityState: state as string,
      addEventListener: (_type: string, fn: () => void) => void listeners.add(fn),
      removeEventListener: (_type: string, fn: () => void) => void listeners.delete(fn),
      emit: () => listeners.forEach((fn) => fn()),
      size: () => listeners.size,
    };
  }

  test("avisa en la medianoche de Madrid y se rearma para la siguiente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T22:59:00.000Z")); // 23:59:00 en Madrid
    const onChange = vi.fn();
    const stop = watchMadridDay(onChange, undefined);
    vi.advanceTimersByTime(59_000);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 3_600_000);
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  test("al volver a estar visible avisa y rearma; oculta no avisa", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T11:00:00.000Z"));
    const doc = fakeDoc("hidden");
    const onChange = vi.fn();
    const stop = watchMadridDay(onChange, doc);
    doc.emit();
    expect(onChange).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.emit();
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  test("al cancelar no queda temporizador ni listener (Strict Mode)", () => {
    vi.useFakeTimers();
    const doc = fakeDoc("visible");
    const onChange = vi.fn();
    watchMadridDay(onChange, doc)();
    watchMadridDay(onChange, doc)();
    expect(doc.size()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(48 * 3_600_000);
    expect(onChange).not.toHaveBeenCalled();
  });
});
