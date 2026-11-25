import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ContactHistoryItem } from "./contact-history-item";

function renderItem(props: Partial<Parameters<typeof ContactHistoryItem>[0]> = {}) {
  render(
    <ul>
      <ContactHistoryItem
        type="whatsapp"
        date="2026-11-23"
        note="Envié el presupuesto de hogar."
        author="Antonio (anotada por Miriam)"
        {...props}
      />
    </ul>,
  );
  return screen.getByRole("listitem");
}

describe("ContactHistoryItem (ARC-14)", () => {
  test("muestra canal, fecha, nota y autor", () => {
    const item = renderItem();
    expect(item.textContent).toContain("WhatsApp");
    expect(item.textContent).toContain("23 nov 2026");
    expect(item.textContent).toContain("Envié el presupuesto de hogar.");
    expect(item.textContent).toContain("— Antonio (anotada por Miriam)");
  });

  test("cada canal con su etiqueta", () => {
    const item = renderItem({ type: "redes" });
    expect(item.textContent).toContain("Redes sociales");
  });

  test("la nota conserva los saltos de línea y no se recorta", () => {
    const note = "Primera línea\nSegunda línea";
    renderItem({ note });
    const p = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === note);
    expect(p.className).toContain("whitespace-pre-wrap");
  });

  test("no es pulsable: ni enlaces ni botones", () => {
    renderItem();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
