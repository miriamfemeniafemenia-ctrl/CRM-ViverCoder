import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, test, vi } from "vitest";
import { ReminderItem } from "./reminder-item";

// Fila de recordatorio de P1 y P3 (ARC-16): marcar como hecho con
// confirmación en la fila, foco y vencidos.

function renderItem(props: Partial<Parameters<typeof ReminderItem>[0]> = {}) {
  const onComplete = vi.fn().mockResolvedValue(null);
  const onDelete = vi.fn().mockResolvedValue(null);
  render(
    <ul>
      <ReminderItem
        date="2026-11-20"
        note="Llamar para confirmar el presupuesto"
        assignedTo="Antonio"
        overdue={false}
        editHref="/clientes/c1/recordatorios/r1/editar"
        onComplete={onComplete}
        onDelete={onDelete}
        {...props}
      />
    </ul>,
  );
  return { item: screen.getByRole("listitem"), onComplete, onDelete };
}

const checkButton = () => screen.getByRole("button", { name: "Marcar como hecho" });

describe("ReminderItem: marcar como hecho (ARC-16)", () => {
  test("el check pide confirmación en la fila, con el foco en «No»", async () => {
    const { item, onComplete } = renderItem();
    await userEvent.click(checkButton());

    expect(within(item).getByText("¿Marcar como hecho?")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "No" }));
    // Mientras confirma, no hay otras acciones.
    expect(screen.queryByRole("button", { name: "Marcar como hecho" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Editar recordatorio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Eliminar recordatorio" })).toBeNull();
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("«No» cierra sin marcar y el foco vuelve al check", async () => {
    const { onComplete } = renderItem();
    await userEvent.click(checkButton());
    await userEvent.click(screen.getByRole("button", { name: "No" }));

    expect(screen.queryByText("¿Marcar como hecho?")).toBeNull();
    expect(document.activeElement).toBe(checkButton());
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("«Sí» lo marca una sola vez, aunque se pulse dos veces seguidas", async () => {
    let resolve: (v: unknown) => void = () => {};
    const onComplete = vi.fn(() => new Promise((r) => (resolve = r)));
    const { onDelete } = renderItem({ onComplete });
    await userEvent.click(checkButton());
    const yes = screen.getByRole("button", { name: "Sí" });
    await userEvent.click(yes);
    await userEvent.click(yes);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect((yes as HTMLButtonElement).disabled).toBe(true);
    resolve(null);
    await waitFor(() => expect(screen.queryByText("¿Marcar como hecho?")).toBeNull());
  });

  test("si falla, muestra el error y deja reintentar", async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error("red"));
    renderItem({ onComplete });
    await userEvent.click(checkButton());
    await userEvent.click(screen.getByRole("button", { name: "Sí" }));

    expect(
      await screen.findByText(
        "No se ha podido marcar el recordatorio como hecho. Inténtalo de nuevo.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("¿Marcar como hecho?")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Sí" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  test("un error de negocio muestra su propio texto", async () => {
    const onComplete = vi
      .fn()
      .mockRejectedValue(
        new ConvexError({ userMessage: "El recordatorio ya no existe" }),
      );
    renderItem({ onComplete });
    await userEvent.click(checkButton());
    await userEvent.click(screen.getByRole("button", { name: "Sí" }));

    expect(await screen.findByText("El recordatorio ya no existe")).toBeTruthy();
  });
});

describe("ReminderItem: eliminar", () => {
  test("pide confirmación con el foco en «No»; «No» devuelve el foco a la papelera", async () => {
    const { onDelete, onComplete } = renderItem();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar recordatorio" }));

    expect(screen.getByText("¿Eliminar?")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "No" }));

    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Eliminar recordatorio" }),
    );
    expect(onDelete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  test("«Sí» elimina y no marca como hecho", async () => {
    const { onDelete, onComplete } = renderItem();
    await userEvent.click(screen.getByRole("button", { name: "Eliminar recordatorio" }));
    await userEvent.click(screen.getByRole("button", { name: "Sí" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("ReminderItem: vencido (ARC-16)", () => {
  test("vencido: «Vencido ·» delante de la fecha y borde de aviso", () => {
    const { item } = renderItem({ overdue: true });
    expect(item.textContent).toContain("Vencido · ");
    expect(item.className).toContain("border-warning-border");
    expect(within(item).getByText(/^Vencido · /).className).toContain("text-warning-fg");
  });

  test("no vencido: sin etiqueta ni borde de aviso", () => {
    const { item } = renderItem({ overdue: false });
    expect(item.textContent).not.toContain("Vencido");
    expect(item.className).not.toContain("border-warning-border");
  });
});
