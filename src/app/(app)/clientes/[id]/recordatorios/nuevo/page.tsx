"use client";

import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { useRouter } from "next/navigation";
import { FormEvent, use, useState } from "react";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";

const NOTE_MAX_LENGTH = 500;

const KNOWN_SERVER_ERRORS = new Set([
  "La nota es obligatoria",
  `La nota es demasiado larga (máximo ${NOTE_MAX_LENGTH} caracteres).`,
  "La fecha no es válida",
  "La fecha de seguimiento no puede ser anterior a hoy",
  "El cliente no existe",
  "El usuario asignado no existe",
]);

// Duplicada (con la misma lógica) en convex/reminders.ts: Convex solo
// empaqueta `convex/`, Next.js solo empaqueta `src/`, no comparten build.
// Si se toca una, tocar la otra.
function todayISODateMadrid() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("No se pudo calcular la fecha de hoy (Europe/Madrid)");
  }
  return `${year}-${month}-${day}`;
}

// /clientes/[id]/recordatorios/nuevo — sub-pantalla "Nuevo recordatorio"
// (ARC-15), abierta desde P3. Incluye el selector de usuario asignado
// (ARC-60), con la persona conectada como valor por defecto.
export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const router = useRouter();
  const backHref = `/clientes/${clientId}`;

  const currentUser = useQuery(api.users.current);
  const users = useQuery(api.users.list);
  const createReminder = useMutation(api.reminders.create);

  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  // "" hasta que el usuario elige algo distinto: el valor por defecto (ARC-60)
  // es la persona conectada, derivado en el render en vez de con un efecto.
  const [assignedToIdOverride, setAssignedToIdOverride] = useState<
    Id<"users"> | ""
  >("");
  const assignedToId = assignedToIdOverride || currentUser?._id || "";
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!date) {
      setError("La fecha de seguimiento es obligatoria.");
      return;
    }
    if (date < todayISODateMadrid()) {
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
      await createReminder({
        clientId,
        date,
        note: normalizedNote,
        assignedToId,
      });
      router.push(backHref);
    } catch (err) {
      const data = err instanceof ConvexError ? err.data : undefined;
      setError(
        typeof data === "string" && KNOWN_SERVER_ERRORS.has(data)
          ? data
          : "No se ha podido guardar el recordatorio. Inténtalo de nuevo.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">
          Nuevo recordatorio
        </h1>

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
              min={todayISODateMadrid()}
              onChange={(event) => setDate(event.target.value)}
              disabled={isSaving}
              className="h-12 w-full rounded-md border border-border-default px-3 text-text-primary outline-none focus:border-primary-500 disabled:bg-neutral-100 disabled:text-text-tertiary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text-secondary">
              Nota
            </span>
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
              onClick={() => router.push(backHref)}
              disabled={isSaving}
              className="flex h-12 items-center justify-center rounded-md border border-border-default px-5 font-medium text-text-primary disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !currentUser || !users}
              className="flex h-12 items-center justify-center rounded-md bg-primary-500 px-5 font-medium text-on-brand disabled:opacity-60"
            >
              {isSaving ? "Guardando…" : "Guardar recordatorio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
