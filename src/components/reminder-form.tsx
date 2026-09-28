"use client";

import { useQuery } from "convex/react";
import { FormEvent, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  NOTE_MAX_LENGTH,
  reminderErrorMessage,
  todayISODateMadrid,
} from "@/lib/reminders";

export type ReminderFormValues = {
  date: string;
  note: string;
  assignedToId: Id<"users">;
};

// Formulario compartido por "Nuevo recordatorio" (ARC-15/ARC-60) y "Editar
// recordatorio" (ARC-61). `isEdit` solo se pasa en edición: mientras la
// fecha no cambie se acepta aunque ya esté vencida.
export function ReminderForm({
  initialDate = "",
  initialNote = "",
  initialAssignedToId,
  isEdit = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialDate?: string;
  initialNote?: string;
  initialAssignedToId?: Id<"users">;
  isEdit?: boolean;
  submitLabel: string;
  onSubmit: (values: ReminderFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const currentUser = useQuery(api.users.current);
  const users = useQuery(api.users.list);

  const [date, setDate] = useState(initialDate);
  const [note, setNote] = useState(initialNote);
  // "" hasta que el usuario elige algo distinto: el valor por defecto es el
  // asignado actual (edición) o la persona conectada (alta, ARC-60), derivado
  // en el render en vez de con un efecto.
  const [assignedToIdOverride, setAssignedToIdOverride] = useState<
    Id<"users"> | ""
  >("");
  const candidateAssignedToId =
    assignedToIdOverride || initialAssignedToId || currentUser?._id || "";
  // Si el asignado ya no está en la lista (usuario eliminado) no se preselecciona:
  // el select muestra "Selecciona…" y el guardado pide elegir a alguien.
  const assignedToId =
    users && !users.some((u) => u._id === candidateAssignedToId)
      ? ""
      : candidateAssignedToId;
  const [error, setError] = useState<string | null>(null);
  // Alta: desde hoy. Edición: desde hoy, o desde la fecha original si ya está
  // vencida — con un `min` posterior a ella el navegador bloquearía el
  // guardado de una nota sin tocar la fecha.
  const today = todayISODateMadrid();
  const originalDate = isEdit ? initialDate : undefined;
  const minDate =
    originalDate !== undefined && originalDate < today ? originalDate : today;
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!date) {
      setError("La fecha de seguimiento es obligatoria.");
      return;
    }
    if (date !== originalDate && date < todayISODateMadrid()) {
      setError("La fecha de seguimiento no puede ser anterior a hoy.");
      return;
    }
    const normalizedNote = note.trim();
    if (!normalizedNote) {
      setError("La nota es obligatoria.");
      return;
    }
    if (normalizedNote.length > NOTE_MAX_LENGTH) {
      setError(
        `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`,
      );
      return;
    }
    if (!assignedToId) {
      setError("Selecciona a quién se asigna el recordatorio.");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ date, note: normalizedNote, assignedToId });
    } catch (err) {
      setError(
        reminderErrorMessage(
          err,
          "No se ha podido guardar el recordatorio. Inténtalo de nuevo.",
        ),
      );
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-border-default bg-surface-card p-6 shadow-sm"
    >
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-secondary">
          Fecha de seguimiento
        </span>
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={(event) => setDate(event.target.value)}
          disabled={isSaving}
          className="h-12 w-full rounded-md border border-border-default px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-secondary">Nota</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Ej.: Enviar presupuesto de hogar"
          disabled={isSaving}
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          className="w-full rounded-md border border-border-default px-3 py-2 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-secondary">
          Asignado a
        </span>
        <select
          value={assignedToId}
          onChange={(event) =>
            setAssignedToIdOverride(event.target.value as Id<"users">)
          }
          disabled={isSaving || !users}
          className="h-12 w-full rounded-md border border-border-default bg-surface-card px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
        >
          {!users && <option value="">Cargando…</option>}
          {users && !assignedToId && <option value="">Selecciona…</option>}
          {users?.map((option) => (
            <option key={option._id} value={option._id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg px-4 py-3">
          <span className="text-warning-fg">⚠</span>
          <span className="text-sm text-warning-fg">{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex h-12 items-center justify-center rounded-md border border-border-default px-5 font-medium text-text-primary disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving || !users || (!initialAssignedToId && !currentUser)}
          className="flex h-12 items-center justify-center rounded-md bg-primary-500 px-5 font-medium text-on-brand disabled:opacity-60"
        >
          {isSaving ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
