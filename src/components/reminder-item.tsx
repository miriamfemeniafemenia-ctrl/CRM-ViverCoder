"use client";

import Link from "next/link";
import { useState } from "react";
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
  "relative inline-flex h-7 w-7 items-center justify-center rounded-sm text-text-tertiary before:absolute before:-inset-1 hover:bg-surface-sunken";

// Fila de recordatorio de P3 (ARC-61), portada de
// `lists/ReminderItem` del sistema de diseño. Devuelve un <li>: se usa dentro
// de un <ul>. La fila no es clicable; solo lápiz (edita) y papelera (elimina,
// con confirmación en la propia fila). "Marcar como hecho" es ARC-62.
export function ReminderItem({
  date,
  note,
  assignedTo,
  editHref,
  onDelete,
}: {
  date: string;
  note: string;
  assignedTo: string;
  editHref: string;
  // Rechaza si falla; el valor con el que resuelve no importa (una mutation de
  // Convex sin retorno resuelve a `null`).
  onDelete: () => Promise<unknown>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    if (isDeleting) return;
    setError(null);
    setIsDeleting(true);
    try {
      await onDelete();
      setConfirming(false);
    } catch (err) {
      setError(
        reminderErrorMessage(
          err,
          "No se ha podido eliminar el recordatorio. Inténtalo de nuevo.",
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <li className="border-border-default flex flex-col gap-1 rounded-md border px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-text-primary font-medium">
              {new Date(`${date}T00:00:00`).toLocaleDateString("es-ES")}
            </span>
            <span className="text-text-tertiary text-xs">Asignado a {assignedTo}</span>
          </div>
          <p className="text-text-secondary">{note}</p>
        </div>

        {confirming ? (
          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-xs">¿Eliminar?</span>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-primary-500 text-on-brand relative h-7 rounded-md px-3 text-xs font-medium before:absolute before:inset-x-0 before:-inset-y-2 disabled:opacity-60"
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              disabled={isDeleting}
              className="border-border-default text-text-primary relative h-7 rounded-md border px-3 text-xs font-medium before:absolute before:inset-x-0 before:-inset-y-2 disabled:opacity-60"
            >
              No
            </button>
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
              type="button"
              aria-label="Eliminar recordatorio"
              title="Eliminar recordatorio"
              onClick={() => setConfirming(true)}
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
