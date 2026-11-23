"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";

// Aviso «¡Venta cerrada!» de la ficha P3 (F8/ARC-19). Solo se abre cuando el
// servidor confirma el paso a «Cerrado» (`shouldShowClosedPrompt`); el estado
// ya está guardado, así que «Omitir» no deshace nada.
//
// `<dialog>` nativo con `showModal()`: el foco queda dentro y Escape lo cierra
// sin código propio. Al cerrarse, el foco vuelve al elemento que lo tenía al
// abrirlo (el badge), solo si sigue en la página.
export function ClosedSaleDialog({
  open,
  annotateHref,
  onClose,
}: {
  open: boolean;
  // «Anotar lo que contrató»: «Anotar interacción» con `?motivo=venta-cerrada`.
  annotateHref: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // Se captura justo antes de abrir: es el badge que acaba de elegirse.
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleClose}
      className="bg-surface-card text-text-primary backdrop:bg-surface-overlay m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border-0 p-6 shadow-md"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        ¡Venta cerrada!
      </h2>
      <p className="text-text-secondary mt-2 text-sm">
        ¿Quieres anotar qué contrató el cliente?
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="border-border-default text-text-primary flex h-12 items-center justify-center rounded-md border px-5 font-medium"
        >
          Omitir
        </button>
        <Link
          href={annotateHref}
          className="bg-primary-500 text-on-brand flex h-12 items-center justify-center rounded-md px-5 font-medium"
        >
          Anotar lo que contrató
        </Link>
      </div>
    </dialog>
  );
}
