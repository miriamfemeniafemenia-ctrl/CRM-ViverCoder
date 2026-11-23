import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import { BadgeMenu } from "./badge-menu";

type P = "alta" | "media" | "baja";
const OPTIONS: readonly { value: P; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];
const SAVE_ERROR = "No se ha podido cambiar la prioridad. Inténtalo de nuevo.";

function renderMenu({
  value = "media" as P,
  onChange = vi.fn(() => Promise.resolve()),
  onError = vi.fn(),
} = {}) {
  render(
    <BadgeMenu
      name="Prioridad"
      value={value}
      options={OPTIONS}
      badgeClass={() => ""}
      onChange={onChange}
      onError={onError}
      saveErrorMessage={SAVE_ERROR}
    />,
  );
  const badge = screen.getByRole("button", { name: /^Prioridad/ });
  return { badge, onChange, onError };
}

function focusedLabel() {
  return document.activeElement?.textContent?.replace("✓", "").trim();
}

describe("BadgeMenu (ARC-33, ARC-18)", () => {
  test("↓ abre el menú con el foco en la opción actual", async () => {
    const { badge } = renderMenu();
    badge.focus();

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("menu", { name: "Prioridad" })).toBeTruthy();
    expect(badge.getAttribute("aria-expanded")).toBe("true");
    expect(focusedLabel()).toBe("Media");
  });

  test("↓/↑ son circulares; Inicio y Fin van a los extremos", async () => {
    const { badge } = renderMenu();
    badge.focus();
    await userEvent.keyboard("{ArrowDown}");

    await userEvent.keyboard("{ArrowDown}");
    expect(focusedLabel()).toBe("Baja");
    await userEvent.keyboard("{ArrowDown}");
    expect(focusedLabel()).toBe("Alta");
    await userEvent.keyboard("{ArrowUp}");
    expect(focusedLabel()).toBe("Baja");
    await userEvent.keyboard("{Home}");
    expect(focusedLabel()).toBe("Alta");
    await userEvent.keyboard("{End}");
    expect(focusedLabel()).toBe("Baja");
  });

  test("Enter elige la opción y llama a onChange", async () => {
    const { badge, onChange } = renderMenu();
    badge.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("baja");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("Escape cierra sin cambiar nada y devuelve el foco al badge", async () => {
    const { badge, onChange } = renderMenu();
    badge.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(badge);
  });

  test("elegir el valor actual no llama a onChange", async () => {
    const { badge, onChange } = renderMenu();
    await userEvent.click(badge);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Media" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("un fallo no previsto muestra el mensaje genérico", async () => {
    const { badge, onError } = renderMenu({
      onChange: vi.fn(() => Promise.reject(new Error("red caída"))),
    });
    await userEvent.click(badge);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Alta" }));

    await waitFor(() => expect(onError).toHaveBeenLastCalledWith(SAVE_ERROR));
  });

  test("un ConvexError conocido muestra su propio texto", async () => {
    const known = "El DNI/NIE no es válido.";
    const { badge, onError } = renderMenu({
      onChange: vi.fn(() => Promise.reject(new ConvexError(known))),
    });
    await userEvent.click(badge);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Alta" }));

    await waitFor(() => expect(onError).toHaveBeenLastCalledWith(known));
  });

  test("mientras se guarda, el menú no se abre", async () => {
    let finish!: () => void;
    const { badge, onChange } = renderMenu({
      onChange: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    await userEvent.click(badge);
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Alta" }));

    const busyBadge = screen.getByRole("button", { name: /guardando/ });
    expect(busyBadge.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(busyBadge);
    expect(screen.queryByRole("menu")).toBeNull();

    finish();
    await waitFor(() => expect(badge.getAttribute("aria-busy")).toBeNull());
    await userEvent.click(badge);
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
