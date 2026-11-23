import { describe, expect, test } from "vitest";
import {
  CLOSED_SALE_NOTE_PLACEHOLDER,
  DEFAULT_NOTE_PLACEHOLDER,
  keepSaleStatusLabel,
  notePlaceholder,
  parseMotivo,
  saleStatusToSend,
} from "./contact-form";
import { SALE_STATUS_OPTIONS } from "./sale-status";

describe("parseMotivo", () => {
  test("solo el valor exacto «venta-cerrada»", () => {
    expect(parseMotivo("venta-cerrada")).toBe("venta-cerrada");
  });
  test.each([
    ["sin parámetro", undefined],
    ["vacío", ""],
    ["otro valor", "otra-cosa"],
    ["mayúsculas", "Venta-Cerrada"],
    ["con espacios", " venta-cerrada "],
    ["repetido", ["venta-cerrada", "venta-cerrada"]],
  ])("%s → undefined", (_, raw) => {
    expect(parseMotivo(raw)).toBeUndefined();
  });
});

describe("keepSaleStatusLabel", () => {
  test("cliente nuevo o sin estado conocido: queda Interesado", () => {
    expect(keepSaleStatusLabel(undefined)).toBe("Sin cambios (Interesado)");
  });
  test.each(SALE_STATUS_OPTIONS.map((o) => [o.value, o.label] as const))(
    "cliente en %s muestra su estado actual",
    (value, label) => {
      expect(keepSaleStatusLabel(value)).toBe(`Sin cambios (ahora: ${label})`);
    },
  );
});

describe("saleStatusToSend", () => {
  test("«Sin cambios» no envía nada", () => {
    expect(saleStatusToSend("")).toBeUndefined();
  });
  test.each(SALE_STATUS_OPTIONS.map((o) => o.value))("%s se envía tal cual", (value) => {
    expect(saleStatusToSend(value)).toBe(value);
  });
});

describe("notePlaceholder (ARC-19, opción A)", () => {
  test("al elegir Cerrado, pista de lo contratado", () => {
    expect(notePlaceholder("cerrado", undefined)).toBe(CLOSED_SALE_NOTE_PLACEHOLDER);
  });
  test("al venir del aviso de venta cerrada, pista de lo contratado", () => {
    expect(notePlaceholder("", "venta-cerrada")).toBe(CLOSED_SALE_NOTE_PLACEHOLDER);
  });
  test.each(["", "interesado", "presupuesto", "perdido"] as const)(
    "«%s» sin motivo: pista normal",
    (choice) => {
      expect(notePlaceholder(choice, undefined)).toBe(DEFAULT_NOTE_PLACEHOLDER);
    },
  );
  test("el texto de la pista es el de ARC-19", () => {
    expect(CLOSED_SALE_NOTE_PLACEHOLDER).toBe(
      "¿Qué contrató el cliente? Ej: Seguro de coche, póliza de hogar...",
    );
  });
});
