// Pruebas de los helpers de P1 «Hoy» / «Próximas» (ARC-62). Fechas y horas
// fijas: ninguna depende del reloj ni de la zona horaria del proceso.
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  clientFilterOptions,
  countDueOrToday,
  filterByClient,
  filterByDue,
  formatBadgeCount,
  formatLongDate,
  groupByDate,
  msUntilNextMadridMidnight,
  pendingTasksLabel,
  resolveClientFilter,
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

describe("filterByDue", () => {
  const today = "2026-11-02";
  const input = [r("2026-10-30", "a"), r("2026-11-01", "b"), r("2026-11-02", "c"), r("2026-11-03", "d")];

  test("«todas» devuelve todo y en el mismo orden", () => {
    expect(filterByDue(input, "todas", today).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  test("«vencidas» solo las anteriores a hoy (ayer sí, hoy no, mañana no)", () => {
    expect(filterByDue(input, "vencidas", today).map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("«hoy» solo las de hoy", () => {
    expect(filterByDue(input, "hoy", today).map((x) => x.id)).toEqual(["c"]);
  });

  test("límites de mes y de año", () => {
    expect(filterByDue([r("2026-09-30")], "vencidas", "2026-10-01")).toHaveLength(1);
    expect(filterByDue([r("2026-10-01")], "vencidas", "2026-09-30")).toHaveLength(0);
    expect(filterByDue([r("2026-12-31")], "vencidas", "2027-01-01")).toHaveLength(1);
    expect(filterByDue([r("2027-01-01")], "hoy", "2026-12-31")).toHaveLength(0);
  });

  test("lista vacía y sin mutar la entrada", () => {
    expect(filterByDue([], "vencidas", today)).toEqual([]);
    const frozen = Object.freeze([Object.freeze(r("2026-11-01")), Object.freeze(r("2026-11-02"))]);
    for (const filter of ["todas", "vencidas", "hoy"] as const) {
      expect(() => filterByDue(frozen, filter, today)).not.toThrow();
    }
    expect(frozen).toHaveLength(2);
  });
});

const rc = (clientId: string, clientName: string | null, date = "2026-11-02", id = `${clientId}-${date}`) => ({
  clientId,
  clientName,
  date,
  id,
});

describe("filterByClient", () => {
  const input = [rc("c1", "Ana", "2026-11-01"), rc("c2", "Beatriz"), rc("c1", "Ana", "2026-11-03")];

  test("null devuelve todos", () => {
    expect(filterByClient(input, null)).toHaveLength(3);
  });

  test("un cliente devuelve solo los suyos y en orden", () => {
    expect(filterByClient(input, "c1").map((x) => x.date)).toEqual(["2026-11-01", "2026-11-03"]);
  });

  test("cliente sin recordatorios devuelve []", () => {
    expect(filterByClient(input, "c9")).toEqual([]);
  });

  test("no muta la entrada", () => {
    const frozen = Object.freeze(input.map((x) => Object.freeze(x)));
    expect(() => filterByClient(frozen, "c1")).not.toThrow();
    expect(frozen).toHaveLength(3);
  });
});

describe("clientFilterOptions", () => {
  test("una opción por cliente, ordenadas con acentos y sin sufijo si el nombre es único", () => {
    const options = clientFilterOptions([
      rc("c2", "Beatriz"),
      rc("c1", "Álvaro"),
      rc("c2", "Beatriz", "2026-11-05"),
      rc("c3", "Zoe"),
    ]);
    expect(options).toEqual([
      { id: "c1", label: "Álvaro" },
      { id: "c2", label: "Beatriz" },
      { id: "c3", label: "Zoe" },
    ]);
  });

  test("los homónimos se numeran por orden de id, con independencia del orden de entrada", () => {
    const a = clientFilterOptions([rc("c9", "Ana"), rc("c2", "Ana"), rc("c5", "Ana")]);
    const b = clientFilterOptions([rc("c5", "Ana"), rc("c9", "Ana"), rc("c2", "Ana")]);
    expect(a).toEqual([
      { id: "c2", label: "Ana (1)" },
      { id: "c5", label: "Ana (2)" },
      { id: "c9", label: "Ana (3)" },
    ]);
    expect(b).toEqual(a);
  });

  test("los no homónimos dan las mismas opciones con la entrada barajada (sin resets falsos)", () => {
    const items = [rc("c1", "Ana"), rc("c2", "Beatriz"), rc("c3", "Carlos"), rc("c2", "Beatriz", "2026-11-09")];
    const expected = clientFilterOptions(items);
    expect(clientFilterOptions([...items].reverse())).toEqual(expected);
    expect(clientFilterOptions([items[2], items[0], items[3], items[1]])).toEqual(expected);
  });

  test("los clientes borrados (nombre null) se muestran como «Cliente no disponible» y se numeran si hay varios", () => {
    expect(clientFilterOptions([rc("c1", null)])).toEqual([{ id: "c1", label: "Cliente no disponible" }]);
    expect(clientFilterOptions([rc("c2", null), rc("c1", null)])).toEqual([
      { id: "c1", label: "Cliente no disponible (1)" },
      { id: "c2", label: "Cliente no disponible (2)" },
    ]);
  });

  test("un homónimo no afecta a los demás nombres y la lista vacía da []", () => {
    expect(clientFilterOptions([rc("c1", "Ana"), rc("c2", "Ana"), rc("c3", "Luis")]).map((o) => o.label)).toEqual([
      "Ana (1)",
      "Ana (2)",
      "Luis",
    ]);
    expect(clientFilterOptions([])).toEqual([]);
  });
});

describe("resolveClientFilter", () => {
  const options = [{ id: "c1" }, { id: "c2" }];

  test("el cliente elegido se mantiene si sigue en las opciones; si no, null", () => {
    expect(resolveClientFilter("c1", options)).toBe("c1");
    expect(resolveClientFilter("c9", options)).toBeNull();
    expect(resolveClientFilter(null, options)).toBeNull();
    expect(resolveClientFilter("c1", [])).toBeNull();
  });

  test("tras resetear el estado a null, que el cliente vuelva a tener recordatorios no reactiva el filtro", () => {
    let state: string | null = "c1";
    // c1 se queda sin recordatorios: el valor resuelto difiere y la página resetea.
    const withoutC1 = [{ id: "c2" }];
    if (resolveClientFilter(state, withoutC1) !== state) state = null;
    expect(state).toBeNull();
    // c1 vuelve a tener un recordatorio: con el estado ya en null no hay filtro.
    expect(resolveClientFilter(state, options)).toBeNull();
  });
});

describe("combinación cliente → separación Hoy/Próximas → vencimiento", () => {
  const today = "2026-11-02";
  const items = [
    rc("c1", "Ana", "2026-10-30", "a1"),
    rc("c1", "Ana", "2026-11-02", "a2"),
    rc("c1", "Ana", "2026-11-04", "a3"),
    rc("c2", "Luis", "2026-10-31", "l1"),
    rc("c2", "Luis", "2026-11-02", "l2"),
    rc("c2", "Luis", "2026-11-05", "l3"),
  ];

  test("equivale a filtrar por todos los criterios a la vez", () => {
    const { dueOrToday } = splitRemindersByToday(filterByClient(items, "c1"), today);
    expect(filterByDue(dueOrToday, "vencidas", today).map((x) => x.id)).toEqual(["a1"]);
    expect(filterByDue(dueOrToday, "hoy", today).map((x) => x.id)).toEqual(["a2"]);
    expect(filterByDue(dueOrToday, "todas", today).map((x) => x.id)).toEqual(["a1", "a2"]);
  });

  test("el filtro de vencimiento no toca «Próximas»", () => {
    const { upcoming } = splitRemindersByToday(filterByClient(items, null), today);
    expect(upcoming.map((x) => x.id)).toEqual(["a3", "l3"]);
    expect(filterByClient(upcoming, "c2").map((x) => x.id)).toEqual(["l3"]);
  });
});

// Los mismos casos que `countDueByAssignee` en convex/reminders.test.ts: el
// cálculo del cliente (pestaña «Hoy») y el del servidor (insignia del menú)
// deben coincidir, y estas dos suites son lo que vigila que no se separen.
describe("countDueOrToday", () => {
  const TODAY = "2026-11-02";

  test("cuenta vencidos y de hoy, no los de mañana (límites)", () => {
    const items = [r("2026-10-31"), r("2026-11-01"), r(TODAY), r("2026-11-03")];
    expect(countDueOrToday(items, TODAY)).toBe(3);
  });

  test("límites de mes y de año", () => {
    const items = [r("2026-12-31")];
    expect(countDueOrToday(items, "2027-01-01")).toBe(1);
    expect(countDueOrToday(items, "2026-12-31")).toBe(1);
    expect(countDueOrToday(items, "2026-12-30")).toBe(0);
  });

  test("cambio de día: uno de «mañana» cuenta 0 hoy y 1 al día siguiente; uno de hoy sigue contando", () => {
    const items = [r("2026-11-03"), r(TODAY)];
    expect(countDueOrToday(items, TODAY)).toBe(1);
    expect(countDueOrToday(items, "2026-11-03")).toBe(2);
  });

  test("lista vacía y sin mutar la entrada", () => {
    expect(countDueOrToday([], TODAY)).toBe(0);
    const frozen = Object.freeze([Object.freeze(r("2026-11-01")), Object.freeze(r("2026-11-09"))]);
    expect(countDueOrToday(frozen, TODAY)).toBe(1);
    expect(frozen).toHaveLength(2);
  });
});

describe("formatBadgeCount", () => {
  test.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("sin insignia para %s", (count) => {
    expect(formatBadgeCount(count)).toBeNull();
  });

  test.each([
    [1, "1"],
    [9, "9"],
    [10, "9+"],
    [150, "9+"],
  ])("%d → %s", (count, expected) => {
    expect(formatBadgeCount(count)).toBe(expected);
  });
});

describe("pendingTasksLabel", () => {
  test("singular y plural con el número real", () => {
    expect(pendingTasksLabel(1)).toBe("1 tarea pendiente");
    expect(pendingTasksLabel(2)).toBe("2 tareas pendientes");
    expect(pendingTasksLabel(15)).toBe("15 tareas pendientes");
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
