"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { reminderErrorMessage } from "@/lib/reminders";

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const iconButtonClass =
  "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-text-tertiary before:absolute before:-inset-1 hover:bg-surface-sunken disabled:opacity-60";

type Pending = "complete" | "delete";

const CONFIRM: Record<Pending, { question: string; fallback: string }> = {
  complete: {
    question: "¿Marcar como hecho?",
    fallback: "No se ha podido marcar el recordatorio como hecho. Inténtalo de nuevo.",
  },
  delete: {
    question: "¿Eliminar?",
    fallback: "No se ha podido eliminar el recordatorio. Inténtalo de nuevo.",
  },
};

// Fila de recordatorio de P1 y P3 (ARC-61, ARC-70, ARC-16), portada de
// `lists/ReminderItem` del sistema de diseño. Devuelve un <li>: se usa dentro
// de un <ul>. La fila no es clicable: check a la izquierda (marcar como hecho),
// lápiz (edita) y papelera (elimina). Marcar como hecho y eliminar piden
// confirmación en la propia fila; al abrirla el foco va a «No» y, si se
// cancela, vuelve al botón que la abrió. Vencido (fecha pasada y aún
// pendiente): borde izquierdo y «Vencido ·» en color de aviso.
export function ReminderItem({
  clientName,
  clientHref,
  date,
  note,
  assignedTo,
  overdue,
  editHref,
  onComplete,
  onDelete,
}: {
  // `undefined` = P3 (no se muestra, ya está dentro de la ficha del cliente);
  // `null` = cliente borrado ("Cliente no disponible"); string = nombre. Solo
  // lo pasa P1, donde cada fila puede ser de un cliente distinto.
  clientName?: string | null;
  // Solo P1 (ARC-64): convierte el nombre en un enlace a la ficha. Sin enlace si
  // no se pasa o si el cliente ya no existe (`clientName === null`).
  clientHref?: string;
  date: string;
  note: string;
  assignedTo: string;
  // Lo calcula la página: `date < hoy` (Europe/Madrid, `useTodayMadrid`).
  overdue: boolean;
  editHref: string;
  // Las dos rechazan si fallan; el valor con el que resuelven no importa (una
  // mutation de Convex sin retorno resuelve a `null`). Al completarse, la
  // query reactiva quita la fila de la lista.
  onComplete: () => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completeRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  // Botón al que vuelve el foco al cancelar una confirmación (un ref: no se
  // pinta, solo lo lee el efecto).
  const returnFocusRef = useRef<Pending | null>(null);

  useEffect(() => {
    if (confirming !== null) {
      noRef.current?.focus();
      return;
    }
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target !== null) {
      (target === "complete" ? completeRef : deleteRef).current?.focus();
    }
  }, [confirming]);

  function open(action: Pending) {
    setError(null);
    setConfirming(action);
  }

  function cancel() {
    returnFocusRef.current = confirming;
    setConfirming(null);
    setError(null);
  }

  async function handleConfirm() {
    if (isSaving || confirming === null) return;
    const action = confirming;
    setError(null);
    setIsSaving(true);
    try {
      await (action === "complete" ? onComplete() : onDelete());
      setConfirming(null);
    } catch (err) {
      setError(reminderErrorMessage(err, CONFIRM[action].fallback));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <li
      className={`flex flex-col gap-1 rounded-md border px-4 py-3 ${
        overdue ? "border-warning-border border-l-[3px]" : "border-border-default"
      }`}
    >
      <div className="flex items-start gap-3">
        {confirming === null && (
          <button
            ref={completeRef}
            type="button"
            aria-label="Marcar como hecho"
            title="Marcar como hecho"
            onClick={() => open("complete")}
            className={iconButtonClass}
          >
            <svg {...iconProps} width={16} height={16}>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12.5l2.5 2.5L16 9" />
            </svg>
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {clientName !== undefined &&
            (clientHref && clientName !== null ? (
              <Link
                href={clientHref}
                className="text-text-primary truncate text-sm font-semibold hover:underline"
              >
                {clientName}
              </Link>
            ) : (
              <span className="text-text-primary truncate text-sm font-semibold">
                {clientName ?? "Cliente no disponible"}
              </span>
            ))}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span
              className={`font-medium ${overdue ? "text-warning-fg" : "text-text-primary"}`}
            >
              {overdue && "Vencido · "}
              {new Date(`${date}T00:00:00`).toLocaleDateString("es-ES")}
            </span>
            <span className="text-text-tertiary text-xs">Asignado a {assignedTo}</span>
          </div>
          <p className="text-text-secondary [overflow-wrap:anywhere]">{note}</p>
        </div>

        {confirming !== null ? (
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <span className="text-text-secondary text-xs">
              {CONFIRM[confirming].question}
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className="bg-primary-500 text-on-brand relative h-7 rounded-md px-3 text-xs font-medium before:absolute before:inset-x-0 before:-inset-y-2 disabled:opacity-60"
              >
                Sí
              </button>
              <button
                ref={noRef}
                type="button"
                onClick={cancel}
                disabled={isSaving}
                className="border-border-default text-text-primary relative h-7 rounded-md border px-3 text-xs font-medium before:absolute before:inset-x-0 before:-inset-y-2 disabled:opacity-60"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href={editHref}
              aria-label="Editar recordatorio"
              title="Editar recordatorio"
              className={iconButtonClass}
            >
              <svg {...iconProps}>
                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
              </svg>
            </Link>
            <button
              ref={deleteRef}
              type="button"
              aria-label="Eliminar recordatorio"
              title="Eliminar recordatorio"
              onClick={() => open("delete")}
              className={iconButtonClass}
            >
              <svg {...iconProps}>
                <path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m3 0-.8 12.1a2 2 0 0 1-2 1.9H7.8a2 2 0 0 1-2-1.9L5 7z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="border-warning-border bg-warning-bg flex items-start gap-2 rounded-md border px-3 py-2">
          <span className="text-warning-fg">⚠</span>
          <span className="text-warning-fg text-xs">{error}</span>
        </div>
      )}
    </li>
  );
}
