import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, test } from "vitest";
import { api } from "../../../../../convex/_generated/api";
import { mockMutation, setQuery } from "@/test/convex-mock";
import type { SaleStatus } from "@/types";
import Page from "./page";

// Ficha P3: el aviso «¡Venta cerrada!» (ARC-19) lo decide la respuesta de
// `clients.setSaleStatus`, no el valor que la ficha tenía en pantalla.

const CLIENT_ID = "c1";
const CLIENT = {
  _id: CLIENT_ID,
  _creationTime: 0,
  name: "Ana Pérez",
  phone: "600000001",
  channel: "llamada",
  priority: "media",
  saleStatus: "presupuesto",
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  setQuery(api.clients.get, CLIENT);
  setQuery(api.reminders.listPendingByClient, []);
  setQuery(api.users.list, []);
});

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <Page
          params={Promise.resolve({ id: CLIENT_ID })}
          searchParams={Promise.resolve({})}
        />
      </Suspense>,
    );
  });
  return screen.findByRole("button", { name: /^Estado de venta/ });
}

async function chooseSaleStatus(badge: HTMLElement, label: string) {
  await userEvent.click(badge);
  await userEvent.click(screen.getByRole("menuitemradio", { name: label }));
}

function dialogOpen() {
  return document.querySelector("dialog")?.open ?? false;
}

describe("Ficha P3: aviso de venta cerrada (ARC-19)", () => {
  test("se abre cuando el servidor confirma el paso a «Cerrado»", async () => {
    const setSaleStatus = mockMutation(api.clients.setSaleStatus);
    setSaleStatus.mockResolvedValue({
      changed: true,
      previousSaleStatus: "presupuesto",
      saleStatus: "cerrado",
    });
    const badge = await renderPage();

    await chooseSaleStatus(badge, "Cerrado");

    expect(setSaleStatus).toHaveBeenCalledWith({ id: CLIENT_ID, saleStatus: "cerrado" });
    await waitFor(() => expect(dialogOpen()).toBe(true));
    expect(screen.getByRole("dialog", { name: "¡Venta cerrada!" })).toBeTruthy();
  });

  test.each<
    [string, { changed: boolean; previousSaleStatus: SaleStatus; saleStatus: SaleStatus }]
  >([
    [
      "sin cambio real",
      { changed: false, previousSaleStatus: "cerrado", saleStatus: "cerrado" },
    ],
    [
      "ya estaba en «Cerrado»",
      { changed: true, previousSaleStatus: "cerrado", saleStatus: "cerrado" },
    ],
    [
      "el estado nuevo no es «Cerrado»",
      { changed: true, previousSaleStatus: "presupuesto", saleStatus: "perdido" },
    ],
  ])("no se abre si %s", async (_case, result) => {
    const setSaleStatus = mockMutation(api.clients.setSaleStatus);
    setSaleStatus.mockResolvedValue(result);
    const badge = await renderPage();

    await chooseSaleStatus(
      badge,
      result.saleStatus === "perdido" ? "Perdido" : "Cerrado",
    );

    await waitFor(() => expect(setSaleStatus).toHaveBeenCalledTimes(1));
    // Deja terminar la promesa de la mutación antes de comprobar.
    await act(async () => {});
    expect(dialogOpen()).toBe(false);
  });

  test("«Omitir» lo cierra y el foco vuelve al badge de estado", async () => {
    mockMutation(api.clients.setSaleStatus).mockResolvedValue({
      changed: true,
      previousSaleStatus: "presupuesto",
      saleStatus: "cerrado",
    });
    const badge = await renderPage();
    await chooseSaleStatus(badge, "Cerrado");
    await waitFor(() => expect(dialogOpen()).toBe(true));
    expect(document.activeElement).not.toBe(badge);

    await userEvent.click(screen.getByRole("button", { name: "Omitir" }));

    expect(dialogOpen()).toBe(false);
    expect(document.activeElement).toBe(badge);
  });

  test("«Anotar lo que contrató» lleva a «Anotar interacción» con el motivo", async () => {
    mockMutation(api.clients.setSaleStatus).mockResolvedValue({
      changed: true,
      previousSaleStatus: "presupuesto",
      saleStatus: "cerrado",
    });
    const badge = await renderPage();
    await chooseSaleStatus(badge, "Cerrado");
    await waitFor(() => expect(dialogOpen()).toBe(true));

    const link = screen.getByRole("link", { name: "Anotar lo que contrató" });
    expect(link.getAttribute("href")).toBe(
      `/interacciones/nueva?clientId=${CLIENT_ID}&from=${CLIENT_ID}&motivo=venta-cerrada`,
    );
  });
});
