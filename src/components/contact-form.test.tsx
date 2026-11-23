import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  CLOSED_SALE_NOTE_PLACEHOLDER,
  DEFAULT_NOTE_PLACEHOLDER,
} from "@/lib/contact-form";
import { setQuery } from "@/test/convex-mock";
import { ContactForm, type ContactFormValues, type PickedClient } from "./contact-form";

const ME = { _id: "u1" as Id<"users">, name: "Miriam" };
const ANA: PickedClient = {
  _id: "c1" as Id<"clients">,
  name: "Ana Pérez",
  phone: "600000001",
  saleStatus: "presupuesto",
};
const LUIS = {
  _id: "c2" as Id<"clients">,
  name: "Luis Gómez",
  phone: "600000002",
  saleStatus: "interesado" as const,
};

beforeEach(() => {
  setQuery(api.users.current, ME);
  setQuery(api.users.list, [ME]);
  setQuery(api.clients.searchForPicker, [LUIS]);
});

function renderForm(props: Partial<Parameters<typeof ContactForm>[0]> = {}) {
  const onSubmit = vi.fn<(values: ContactFormValues) => Promise<void>>(() =>
    Promise.resolve(),
  );
  render(<ContactForm onSubmit={onSubmit} onCancel={() => {}} {...props} />);
  return { onSubmit };
}

const saleSelect = () =>
  screen.getByLabelText("Estado de venta (opcional)") as HTMLSelectElement;
const noteField = () => screen.getByLabelText("Nota") as HTMLTextAreaElement;
const save = () =>
  userEvent.click(screen.getByRole("button", { name: "Guardar interacción" }));

describe("ContactForm: estado de venta (ARC-18)", () => {
  test("la primera opción muestra el estado actual del cliente", () => {
    renderForm({ initialClient: ANA });
    expect(saleSelect().value).toBe("");
    expect(saleSelect().options[0].text).toBe("Sin cambios (ahora: Presupuesto enviado)");
  });

  test("con «Sin cambios» no se envía estado de venta", async () => {
    const { onSubmit } = renderForm({ initialClient: ANA });
    await userEvent.type(noteField(), "Llamada de seguimiento");
    await save();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = onSubmit.mock.calls[0][0];
    expect(values.saleStatus).toBeUndefined();
    expect(values.target).toEqual({ clientId: ANA._id });
  });

  test("con un estado elegido se envía junto al cliente", async () => {
    const { onSubmit } = renderForm({ initialClient: ANA });
    await userEvent.selectOptions(saleSelect(), "cerrado");
    await userEvent.type(noteField(), "Contrató seguro de coche");
    await save();

    const values = onSubmit.mock.calls[0][0];
    expect(values.saleStatus).toBe("cerrado");
    expect(values.target).toEqual({ clientId: ANA._id });
    expect(values.note).toBe("Contrató seguro de coche");
  });

  test("al cambiar de cliente, la elección vuelve a «Sin cambios»", async () => {
    const { onSubmit } = renderForm({ initialClient: ANA });
    await userEvent.selectOptions(saleSelect(), "cerrado");

    await userEvent.click(screen.getByRole("button", { name: "Cambiar" }));
    await userEvent.type(screen.getByRole("searchbox"), "Luis");
    await userEvent.click(await screen.findByRole("button", { name: /Luis Gómez/ }));

    expect(saleSelect().value).toBe("");
    expect(saleSelect().options[0].text).toBe("Sin cambios (ahora: Interesado)");

    await userEvent.type(noteField(), "Primera llamada");
    await save();
    const values = onSubmit.mock.calls[0][0];
    expect(values.target).toEqual({ clientId: LUIS._id });
    expect(values.saleStatus).toBeUndefined();
  });

  test("un estado elegido antes de tener cliente se descarta al elegir uno", async () => {
    // Sin cliente prefijado: el estado se elige antes de buscar. Al elegir el
    // cliente (`pickClient`), la elección vuelve a «Sin cambios».
    const { onSubmit } = renderForm();
    await userEvent.selectOptions(saleSelect(), "cerrado");

    await userEvent.type(screen.getByRole("searchbox"), "Luis");
    await userEvent.click(await screen.findByRole("button", { name: /Luis Gómez/ }));

    expect(saleSelect().value).toBe("");
    await userEvent.type(noteField(), "Primera llamada");
    await save();
    expect(onSubmit.mock.calls[0][0].saleStatus).toBeUndefined();
  });

  test("al empezar un alta nueva, la elección vuelve a «Sin cambios»", async () => {
    // Sin cliente prefijado, para que la vuelta a «Sin cambios» dependa solo de
    // empezar el alta (`startCreatingClient`) y no de «Cambiar».
    renderForm();
    await userEvent.selectOptions(saleSelect(), "perdido");

    await userEvent.click(
      screen.getByRole("button", { name: "¿No existe? Dar de alta un cliente nuevo" }),
    );

    expect(saleSelect().value).toBe("");
    expect(saleSelect().options[0].text).toBe("Sin cambios (Interesado)");
  });

  test("un cliente nuevo con estado elegido envía el alta y el estado", async () => {
    const { onSubmit } = renderForm();
    await userEvent.click(
      screen.getByRole("button", { name: "¿No existe? Dar de alta un cliente nuevo" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre completo"), "Eva Ruiz");
    await userEvent.type(screen.getByLabelText("Teléfono"), "600000003");
    await userEvent.selectOptions(saleSelect(), "presupuesto");
    await userEvent.type(noteField(), "Pidió presupuesto de hogar");
    await save();

    const values = onSubmit.mock.calls[0][0];
    expect(values.target).toEqual({
      newClient: {
        name: "Eva Ruiz",
        phone: "600000003",
        email: undefined,
        channel: "llamada",
      },
    });
    expect(values.saleStatus).toBe("presupuesto");
  });
});

describe("ContactForm: pista de la nota (ARC-19, «opción A»)", () => {
  test("por defecto, la pista habitual", () => {
    renderForm({ initialClient: ANA });
    expect(noteField().placeholder).toBe(DEFAULT_NOTE_PLACEHOLDER);
  });

  test("al elegir «Cerrado», la pista de venta cerrada", async () => {
    renderForm({ initialClient: ANA });
    await userEvent.selectOptions(saleSelect(), "cerrado");
    expect(noteField().placeholder).toBe(CLOSED_SALE_NOTE_PLACEHOLDER);
    expect(noteField().value).toBe("");
  });

  test("al llegar desde el aviso (motivo venta-cerrada), la pista de venta cerrada", () => {
    renderForm({ initialClient: ANA, motivo: "venta-cerrada" });
    expect(noteField().placeholder).toBe(CLOSED_SALE_NOTE_PLACEHOLDER);
    expect(noteField().value).toBe("");
  });

  test("con «Cerrado» y la nota vacía, error y no se envía", async () => {
    const { onSubmit } = renderForm({ initialClient: ANA });
    await userEvent.selectOptions(saleSelect(), "cerrado");
    await save();

    expect(screen.getByText("La nota es obligatoria.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
