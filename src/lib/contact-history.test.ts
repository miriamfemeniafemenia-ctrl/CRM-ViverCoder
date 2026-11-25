// Pruebas de src/lib/contact-history.ts (ARC-14): etiquetas de canal con
// paridad frente al esquema, fecha del historial y autor.
import { describe, expect, test } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import {
  AUTHOR_LOADING,
  AUTHOR_UNKNOWN,
  CONTACT_TYPE_OPTIONS,
  contactAuthor,
  contactTypeLabel,
  formatContactDate,
} from "./contact-history";

describe("canales de interacción", () => {
  test("cubren exactamente los canales del esquema de `contacts.type`", () => {
    const typeField = schema.tables.contacts.validator.fields.type as unknown as {
      members: { value: string }[];
    };
    const fromSchema = typeField.members.map((m) => m.value).sort();
    expect(CONTACT_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual(fromSchema);
  });

  test("etiquetas", () => {
    expect(contactTypeLabel("llamada")).toBe("Llamada");
    expect(contactTypeLabel("whatsapp")).toBe("WhatsApp");
    expect(contactTypeLabel("correo")).toBe("Correo");
    expect(contactTypeLabel("redes")).toBe("Redes sociales");
    expect(contactTypeLabel("web")).toBe("Web");
  });
});

describe("formatContactDate", () => {
  test("día, mes abreviado y año", () => {
    expect(formatContactDate("2026-11-23")).toBe("23 nov 2026");
  });

  test("día de un dígito y cambio de año, sin que la zona horaria mueva el día", () => {
    expect(formatContactDate("2026-01-01")).toBe("1 ene 2026");
    expect(formatContactDate("2025-12-31")).toBe("31 dic 2025");
  });
});

describe("contactAuthor", () => {
  const ana = "u1" as Id<"users">;
  const luis = "u2" as Id<"users">;
  const borrado = "u9" as Id<"users">;
  const users = [
    { _id: ana, name: "Ana" },
    { _id: luis, name: "Luis" },
  ];

  test("la misma persona la realizó y la anotó", () => {
    expect(contactAuthor(ana, ana, users)).toBe("Ana");
  });

  test("la anotó otra persona", () => {
    expect(contactAuthor(ana, luis, users)).toBe("Ana (anotada por Luis)");
  });

  test("usuario que ya no existe", () => {
    expect(contactAuthor(borrado, borrado, users)).toBe(AUTHOR_UNKNOWN);
    expect(contactAuthor(ana, borrado, users)).toBe(
      `Ana (anotada por ${AUTHOR_UNKNOWN})`,
    );
  });

  test("mientras cargan los usuarios", () => {
    expect(contactAuthor(ana, luis, undefined)).toBe(AUTHOR_LOADING);
  });
});
