import { describe, expect, test } from "vitest";
import { saleStatusValidator } from "../../convex/lib/saleStatus";
import {
  SALE_STATUS_OPTIONS,
  saleStatusBadgeClass,
  saleStatusLabel,
  shouldShowClosedPrompt,
} from "./sale-status";

describe("estado de venta: paridad con el servidor (ARC-18/ARC-77)", () => {
  const serverValues = saleStatusValidator.members.map((m) => m.value);

  test("las opciones son exactamente los valores del validador", () => {
    expect(SALE_STATUS_OPTIONS.map((o) => o.value).sort()).toEqual(
      [...serverValues].sort(),
    );
    expect(serverValues).toHaveLength(4);
  });

  test("cada estado tiene su etiqueta y SU clase de color", () => {
    const expected = {
      interesado: "Interesado",
      presupuesto: "Presupuesto enviado",
      cerrado: "Cerrado",
      perdido: "Perdido",
    } as const;
    for (const v of serverValues) {
      expect(saleStatusLabel(v)).toBe(expected[v]);
      expect(saleStatusBadgeClass(v)).toBe(`bg-sale-${v}-bg text-sale-${v}-fg`);
    }
    expect(new Set(serverValues.map(saleStatusLabel)).size).toBe(4);
    expect(new Set(serverValues.map(saleStatusBadgeClass)).size).toBe(4);
  });
});

describe("shouldShowClosedPrompt (ARC-19)", () => {
  test("solo al pasar de verdad a «cerrado» desde otro estado", () => {
    for (const prev of ["interesado", "presupuesto", "perdido"] as const) {
      expect(
        shouldShowClosedPrompt({
          changed: true,
          previousSaleStatus: prev,
          saleStatus: "cerrado",
        }),
      ).toBe(true);
    }
  });

  test("no si no hubo cambio, si ya estaba cerrado o si el nuevo no es cerrado", () => {
    expect(
      shouldShowClosedPrompt({
        changed: false,
        previousSaleStatus: "cerrado",
        saleStatus: "cerrado",
      }),
    ).toBe(false);
    expect(
      shouldShowClosedPrompt({
        changed: true,
        previousSaleStatus: "cerrado",
        saleStatus: "cerrado",
      }),
    ).toBe(false);
    expect(
      shouldShowClosedPrompt({
        changed: true,
        previousSaleStatus: "cerrado",
        saleStatus: "perdido",
      }),
    ).toBe(false);
    expect(
      shouldShowClosedPrompt({
        changed: true,
        previousSaleStatus: "interesado",
        saleStatus: "presupuesto",
      }),
    ).toBe(false);
  });
});
