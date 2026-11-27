import { act, render, screen, waitFor, within } from "@testing-library/react";
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

async function renderPage(searchParams: { from?: string; vista?: string } = {}) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <Page
          params={Promise.resolve({ id: CLIENT_ID })}
          searchParams={Promise.resolve(searchParams)}
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

describe("Ficha P3: historial de interacciones (ARC-14)", () => {
  const MIRIAM = { _id: "u1", name: "Miriam" };
  const ANTONIO = { _id: "u2", name: "Antonio" };
  // Ya ordenadas como las devuelve `contacts.listByClient`.
  const CONTACTS = [
    {
      _id: "k1",
      type: "llamada",
      note: "Contrató seguro de coche",
      date: "2026-11-23",
      performedById: "u1",
      createdById: "u1",
    },
    {
      _id: "k2",
      type: "whatsapp",
      note: "Pidió presupuesto de hogar",
      date: "2026-11-20",
      performedById: "u2",
      createdById: "u1",
    },
  ];

  const historySection = () =>
    screen.getByRole("region", { name: "Historial de interacciones" });
  const entries = () => within(historySection()).queryAllByRole("listitem");

  test("muestra las interacciones en el orden recibido, con su autor", async () => {
    setQuery(api.users.list, [MIRIAM, ANTONIO]);
    setQuery(api.contacts.listByClient, CONTACTS);
    await renderPage();

    const items = entries();
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Llamada");
    expect(items[0].textContent).toContain("23 nov 2026");
    expect(items[0].textContent).toContain("Contrató seguro de coche");
    expect(items[0].textContent).toContain("— Miriam");
    expect(items[0].textContent).not.toContain("anotada por");
    expect(items[1].textContent).toContain("Pidió presupuesto de hogar");
    expect(items[1].textContent).toContain("— Antonio (anotada por Miriam)");
  });

  test("mientras cargan los usuarios, el autor es «…»", async () => {
    setQuery(api.users.list, undefined);
    setQuery(api.contacts.listByClient, CONTACTS);
    await renderPage();

    expect(entries()[0].textContent).toContain("— …");
  });

  test("sin interacciones, un mensaje y ninguna entrada", async () => {
    setQuery(api.contacts.listByClient, []);
    await renderPage();

    expect(
      within(historySection()).getByText(
        "Todavía no hay interacciones con este cliente.",
      ),
    ).toBeTruthy();
    expect(entries()).toHaveLength(0);
  });

  test("«Anotar interacción» está en la cabecera del historial y lleva al formulario", async () => {
    setQuery(api.contacts.listByClient, []);
    await renderPage();

    const links = screen.getAllByRole("link", { name: "Anotar interacción" });
    expect(links).toHaveLength(1);
    expect(historySection().contains(links[0])).toBe(true);
    expect(links[0].getAttribute("href")).toBe(
      `/interacciones/nueva?clientId=${CLIENT_ID}&from=${CLIENT_ID}`,
    );
  });

  // Posición relativa de dos nodos en el documento.
  const isBefore = (a: Node, b: Node) =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  test("orden normal: datos, historial y recordatorios", async () => {
    setQuery(api.contacts.listByClient, []);
    await renderPage();

    const data = screen.getByRole("heading", { level: 1, name: "Ana Pérez" });
    const history = screen.getByRole("heading", { name: "Historial de interacciones" });
    const reminders = screen.getByRole("heading", { name: "Recordatorios pendientes" });
    expect(isBefore(data, history)).toBe(true);
    expect(isBefore(history, reminders)).toBe(true);
  });

  test("desde P1 con ?vista=recordatorios: recordatorios, datos e historial", async () => {
    setQuery(api.contacts.listByClient, []);
    await renderPage({ from: "p1", vista: "recordatorios" });

    const data = screen.getByRole("heading", { level: 1, name: "Ana Pérez" });
    const history = screen.getByRole("heading", { name: "Historial de interacciones" });
    const reminders = screen.getByRole("heading", { name: "Recordatorios pendientes" });
    expect(isBefore(reminders, data)).toBe(true);
    expect(isBefore(data, history)).toBe(true);
  });
});

describe("Ficha P3: recordatorios (ARC-16)", () => {
  // Fechas fijas y lejanas: no dependen del reloj ni de la zona horaria.
  const reminder = (id: string, date: string) => ({
    _id: id,
    _creationTime: 0,
    clientId: CLIENT_ID,
    date,
    note: `Nota ${id}`,
    status: "pendiente",
    createdById: "u1",
    assignedToId: "u1",
  });

  beforeEach(() => {
    setQuery(api.reminders.listPendingByClient, [
      reminder("r-pasado", "2000-01-01"),
      reminder("r-futuro", "2999-12-31"),
    ]);
    setQuery(api.users.list, [{ _id: "u1", name: "Mónica" }]);
  });

  const row = (note: string) => screen.getByText(note).closest("li") as HTMLElement;

  test("solo el de fecha pasada sale vencido", async () => {
    await renderPage();
    expect(row("Nota r-pasado").textContent).toContain("Vencido · ");
    expect(row("Nota r-futuro").textContent).not.toContain("Vencido");
  });

  test("marcar como hecho llama a reminders.complete con su id", async () => {
    const complete = mockMutation(api.reminders.complete);
    complete.mockResolvedValue(null);
    await renderPage();

    const item = row("Nota r-futuro");
    await userEvent.click(
      within(item).getByRole("button", { name: "Marcar como hecho" }),
    );
    await userEvent.click(within(item).getByRole("button", { name: "Sí" }));

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith({ id: "r-futuro" });
  });
});
