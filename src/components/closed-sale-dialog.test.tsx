import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { ClosedSaleDialog } from "./closed-sale-dialog";

const HREF = "/interacciones/nueva?clientId=c1&from=c1&motivo=venta-cerrada";

// Simula la ficha P3: un botón (el badge) que tiene el foco y abre el aviso.
function Harness({
  onClose = () => {},
  hideBadge = false,
}: {
  onClose?: () => void;
  // Quita el badge de la página (como si la ficha se hubiera vuelto a pintar).
  hideBadge?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!hideBadge && (
        <button type="button" onClick={() => setOpen(true)}>
          Badge
        </button>
      )}
      <ClosedSaleDialog
        open={open}
        annotateHref={HREF}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
    </>
  );
}

function dialog() {
  return document.querySelector("dialog")!;
}

describe("ClosedSaleDialog (ARC-19)", () => {
  test("cerrado no se muestra; abierto es un diálogo con su título", async () => {
    render(<Harness />);
    expect(dialog().open).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Badge" }));

    expect(dialog().open).toBe(true);
    expect(screen.getByRole("dialog", { name: "¡Venta cerrada!" })).toBeTruthy();
  });

  test("el foco entra en el diálogo y «Omitir» lo devuelve al badge", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const badge = screen.getByRole("button", { name: "Badge" });

    await userEvent.click(badge);
    expect(dialog().contains(document.activeElement)).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Omitir" }));

    expect(dialog().open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(badge);
  });

  test("cerrarlo como hace Escape (evento close) también devuelve el foco", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const badge = screen.getByRole("button", { name: "Badge" });
    await userEvent.click(badge);

    act(() => dialog().close());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(badge);
  });

  test("si el elemento con el foco ya no está en la página, no falla", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness onClose={onClose} />);
    const badge = screen.getByRole("button", { name: "Badge" });
    await userEvent.click(badge);

    rerender(<Harness onClose={onClose} hideBadge />);
    expect(badge.isConnected).toBe(false);
    act(() => dialog().close());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(badge);
  });

  test("«Anotar lo que contrató» enlaza a la dirección recibida", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Badge" }));

    const link = screen.getByRole("link", { name: "Anotar lo que contrató" });
    expect(link.getAttribute("href")).toBe(HREF);
  });
});
