import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../convex/_generated/api";
import { mockMutation, setQuery } from "@/test/convex-mock";
import Page from "./page";

// P1 «Mis tareas de hoy» (ARC-16/ARC-17): vencidos destacados y marcar como
// hecho. Fechas fijas y lejanas: no dependen del reloj ni de la zona horaria.

const reminder = (id: string, date: string) => ({
  _id: id,
  _creationTime: 0,
  clientId: `c-${id}`,
  clientName: `Cliente ${id}`,
  date,
  note: `Nota ${id}`,
  status: "pendiente",
  createdById: "u1",
  assignedToId: "u1",
});

beforeEach(() => {
  setQuery(api.users.current, { _id: "u1", name: "Mónica" });
  setQuery(api.reminders.listPendingByAssignee, [
    reminder("r-pasado", "2000-01-01"),
    reminder("r-futuro", "2999-12-31"),
  ]);
});

async function renderPage() {
  await act(async () => {
    render(<Page />);
  });
}

const row = (note: string) => screen.getByText(note).closest("li") as HTMLElement;

describe("P1: recordatorios (ARC-16)", () => {
  test("«Hoy»: el pasado sale vencido", async () => {
    await renderPage();
    expect(row("Nota r-pasado").textContent).toContain("Vencido · ");
    expect(screen.queryByText("Nota r-futuro")).toBeNull();
  });

  test("«Próximas»: el futuro no sale vencido", async () => {
    await renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Próximas" }));
    expect(row("Nota r-futuro").textContent).not.toContain("Vencido");
  });

  test("marcar como hecho llama a reminders.complete con su id", async () => {
    const complete = mockMutation(api.reminders.complete);
    complete.mockResolvedValue(null);
    await renderPage();

    const item = row("Nota r-pasado");
    await userEvent.click(
      within(item).getByRole("button", { name: "Marcar como hecho" }),
    );
    await userEvent.click(within(item).getByRole("button", { name: "Sí" }));

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({ id: "r-pasado" });
  });
});
