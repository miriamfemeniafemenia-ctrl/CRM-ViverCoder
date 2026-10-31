// Pruebas de la navegación P1 → P3 (ARC-64).
import { describe, expect, test } from "vitest";
import { clientPageContext, clientPageHref } from "./client-nav";

describe("clientPageContext", () => {
  test("desde P1 vuelve a P1", () => {
    expect(clientPageContext("p1", undefined)).toEqual({
      backHref: "/",
      backLabel: "← Mis tareas",
      focusReminders: false,
    });
  });

  test("desde P2, sin origen o con origen desconocido vuelve a la lista de clientes", () => {
    for (const from of ["p2", undefined, "", "p6", "otro"]) {
      expect(clientPageContext(from, undefined)).toMatchObject({
        backHref: "/clientes",
        backLabel: "← Clientes",
      });
    }
  });

  test.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "el origen %s no se resuelve contra el prototipo",
    (from) => {
      expect(clientPageContext(from, "recordatorios")).toEqual({
        backHref: "/clientes",
        backLabel: "← Clientes",
        focusReminders: false,
      });
    },
  );

  test("un parámetro repetido (array) se trata como inválido, tanto from como vista", () => {
    expect(clientPageContext(["p1", "p2"], undefined).backHref).toBe("/clientes");
    expect(clientPageContext(["p1"], "recordatorios")).toEqual({
      backHref: "/clientes",
      backLabel: "← Clientes",
      focusReminders: false,
    });
    expect(clientPageContext("p1", ["recordatorios", "recordatorios"]).focusReminders).toBe(false);
    expect(clientPageContext("p1", ["recordatorios"]).focusReminders).toBe(false);
    // from válido y vista repetida: se conserva el «volver» a P1, sin destacar.
    expect(clientPageContext("p1", ["recordatorios", "otra"])).toEqual({
      backHref: "/",
      backLabel: "← Mis tareas",
      focusReminders: false,
    });
  });

  test("los recordatorios solo se destacan con from=p1 y vista=recordatorios", () => {
    expect(clientPageContext("p1", "recordatorios").focusReminders).toBe(true);
    expect(clientPageContext(undefined, "recordatorios").focusReminders).toBe(false);
    expect(clientPageContext("p2", "recordatorios").focusReminders).toBe(false);
    expect(clientPageContext("p1", "otra").focusReminders).toBe(false);
    expect(clientPageContext("p1", undefined).focusReminders).toBe(false);
  });
});

describe("clientPageHref", () => {
  test("sin filtro: solo el origen", () => {
    expect(clientPageHref("abc123", { filtered: false })).toBe("/clientes/abc123?from=p1");
  });

  test("con filtro de cliente: destaca los recordatorios", () => {
    expect(clientPageHref("abc123", { filtered: true })).toBe(
      "/clientes/abc123?from=p1&vista=recordatorios",
    );
  });

  test("codifica el id", () => {
    expect(clientPageHref("a/b?c", { filtered: false })).toBe("/clientes/a%2Fb%3Fc?from=p1");
  });

  test("la URL que genera la entiende clientPageContext", () => {
    const url = new URL(clientPageHref("abc", { filtered: true }), "http://localhost");
    expect(
      clientPageContext(url.searchParams.get("from") ?? undefined, url.searchParams.get("vista") ?? undefined),
    ).toMatchObject({ backHref: "/", focusReminders: true });
  });
});
