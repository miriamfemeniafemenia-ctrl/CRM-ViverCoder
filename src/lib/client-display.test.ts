// Pruebas de src/lib/client-display.ts (ARC-50): formateo defensivo de los
// datos ampliados de la ficha P3 y paridad de la copia de `isValidISODate` con
// la del servidor.
import { describe, expect, test } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { isValidISODate as serverIsValidISODate } from "../../convex/lib/validation";
import {
  agentDisplay,
  EMPTY,
  formatAddress,
  formatBirthDate,
  INVALID_DATE,
  isValidISODate,
  optionLabel,
} from "./client-display";
import { LANGUAGE_OPTIONS, SEX_OPTIONS } from "./client-form";
import { todayISODateMadrid } from "./reminders";

const TODAY = "2026-11-17";

describe("isValidISODate (copia del servidor)", () => {
  // Si se amplía la validación del servidor, ampliar también estos casos.
  const cases = [
    "1900-01-01",
    "1899-12-31",
    TODAY,
    "2026-11-18",
    todayISODateMadrid(),
    "2024-02-29",
    "2023-02-29",
    "2000-02-29",
    "1900-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2025-99-99",
    "2026-12-31",
    "26-1-5",
    "2026-1-5",
    " 2026-01-05",
    "2026-01-05 ",
    "2026-01-05T00:00:00Z",
    "2026/01/05",
    "",
  ];
  test.each(cases)("%j coincide con convex/lib/validation.ts", (value) => {
    expect(isValidISODate(value)).toBe(serverIsValidISODate(value));
  });
});

describe("formatBirthDate", () => {
  test("vacío, solo espacios o no-string → guion", () => {
    expect(formatBirthDate(undefined, TODAY)).toBe(EMPTY);
    expect(formatBirthDate("", TODAY)).toBe(EMPTY);
    expect(formatBirthDate("   ", TODAY)).toBe(EMPTY);
    expect(formatBirthDate(null, TODAY)).toBe(EMPTY);
    expect(formatBirthDate(19900101, TODAY)).toBe(EMPTY);
  });

  test("fecha válida → DD/MM/AAAA, sin desfase de zona horaria", () => {
    expect(formatBirthDate("1985-01-01", TODAY)).toBe("01/01/1985");
    expect(formatBirthDate("2024-02-29", TODAY)).toBe("29/02/2024");
    expect(formatBirthDate(" 1990-12-31 ", TODAY)).toBe("31/12/1990");
  });

  test("bordes del rango del servidor", () => {
    expect(formatBirthDate("1900-01-01", TODAY)).toBe("01/01/1900");
    expect(formatBirthDate("1899-12-31", TODAY)).toBe(INVALID_DATE);
    expect(formatBirthDate(TODAY, TODAY)).toBe("17/11/2026");
    expect(formatBirthDate("2026-11-18", TODAY)).toBe(INVALID_DATE);
  });

  test("fuera de contrato → «Fecha no válida»", () => {
    for (const v of [
      "2025-02-31",
      "2025-99-99",
      "2023-02-29",
      "1985-01-01T10:00:00Z",
      "01/01/1985",
    ]) {
      expect(formatBirthDate(v, TODAY)).toBe(INVALID_DATE);
    }
  });

  test("por defecto compara con hoy en Madrid", () => {
    expect(formatBirthDate("2999-01-01")).toBe(INVALID_DATE);
    expect(formatBirthDate("1985-06-15")).toBe("15/06/1985");
  });
});

describe("formatAddress", () => {
  test("sin dirección → []", () => {
    expect(formatAddress(undefined)).toEqual([]);
    expect(formatAddress(null)).toEqual([]);
    expect(formatAddress({})).toEqual([]);
    expect(formatAddress({ street: "  ", city: "" })).toEqual([]);
    expect(formatAddress("Calle Mayor")).toEqual([]);
  });

  test("completa → dos líneas", () => {
    expect(
      formatAddress({
        street: "Calle Mayor",
        number: "12",
        floorDoor: "3º B",
        postalCode: "46001",
        city: "Valencia",
        province: "Valencia",
      }),
    ).toEqual(["Calle Mayor 12, 3º B", "46001 Valencia (Valencia)"]);
  });

  test("parciales, sin separadores sueltos", () => {
    expect(formatAddress({ postalCode: "46001", city: "Valencia" })).toEqual([
      "46001 Valencia",
    ]);
    expect(formatAddress({ street: "Calle Mayor" })).toEqual(["Calle Mayor"]);
    expect(formatAddress({ floorDoor: "3º B" })).toEqual(["3º B"]);
    expect(formatAddress({ number: "12", province: "Alicante" })).toEqual([
      "12",
      "(Alicante)",
    ]);
  });

  test("recorta espacios e ignora valores no-string", () => {
    expect(
      formatAddress({
        street: "  Calle Mayor ",
        number: 12,
        city: " Xàtiva ",
        province: null,
      }),
    ).toEqual(["Calle Mayor", "Xàtiva"]);
  });
});

describe("optionLabel", () => {
  test("valor conocido → etiqueta", () => {
    expect(optionLabel(SEX_OPTIONS, "mujer")).toBe("Mujer");
    expect(optionLabel(LANGUAGE_OPTIONS, "valenciano")).toBe("Valenciano");
  });

  test("desconocido → el valor recortado; vacío o no-string → guion", () => {
    expect(optionLabel(SEX_OPTIONS, " no binario ")).toBe("no binario");
    expect(optionLabel(SEX_OPTIONS, undefined)).toBe(EMPTY);
    expect(optionLabel(SEX_OPTIONS, "  ")).toBe(EMPTY);
    expect(optionLabel(SEX_OPTIONS, 3)).toBe(EMPTY);
  });
});

describe("agentDisplay", () => {
  const a = "a1" as Id<"users">;
  const b = "b2" as Id<"users">;
  const users = [{ _id: a, name: "Mónica" }];

  test("los cuatro estados", () => {
    expect(agentDisplay(undefined, users)).toEqual({ kind: "none" });
    expect(agentDisplay(undefined, undefined)).toEqual({ kind: "none" });
    expect(agentDisplay(a, undefined)).toEqual({ kind: "loading" });
    expect(agentDisplay(a, users)).toEqual({ kind: "known", name: "Mónica" });
    expect(agentDisplay(b, users)).toEqual({ kind: "unknown" });
  });

  test("usuario sin nombre → desconocido", () => {
    expect(agentDisplay(a, [{ _id: a, name: " " }])).toEqual({ kind: "unknown" });
  });
});
