"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ReminderForm } from "@/components/reminder-form";
import { api } from "../../../../../../../../convex/_generated/api";
import { Doc } from "../../../../../../../../convex/_generated/dataModel";

// /clientes/[id]/recordatorios/[reminderId]/editar — "Nuevo recordatorio" en
// modo edición (ARC-61), abierto desde P3. Se puede guardar sin cambiar una
// fecha ya vencida.
export default function Page({
  params,
}: {
  params: Promise<{ id: string; reminderId: string }>;
}) {
  const { id, reminderId } = use(params);
  const router = useRouter();
  const backHref = `/clientes/${id}`;

  const liveReminder = useQuery(api.reminders.get, { id: reminderId });
  // Copia de lo cargado la primera vez: si otra sesión borra el recordatorio
  // con el formulario abierto, no se desmonta y el guardado devuelve el error
  // "El recordatorio no existe" en vez de perder lo escrito.
  const [loadedReminder, setLoadedReminder] = useState<Doc<"reminders"> | null>(
    null,
  );
  if (liveReminder && !loadedReminder) {
    setLoadedReminder(liveReminder);
  }
  const reminder = loadedReminder ?? liveReminder;
  const updateReminder = useMutation(api.reminders.update);

  if (reminder === undefined) {
    return (
      <div className="flex min-h-full flex-1 flex-col p-6">
        <p className="text-sm text-text-tertiary">Cargando…</p>
      </div>
    );
  }

  // Un recordatorio de otro cliente no se edita bajo la URL de este.
  if (reminder === null || reminder.clientId !== id) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-3 p-6">
        <p className="text-sm text-text-secondary">
          No se encontró este recordatorio.
        </p>
        <Link href={backHref} className="text-sm text-text-link">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="mb-6 text-2xl font-semibold text-text-primary">
          Editar recordatorio
        </h1>

        <ReminderForm
          initialDate={reminder.date}
          initialNote={reminder.note}
          initialAssignedToId={reminder.assignedToId}
          // El formulario compara contra la fecha con la que se abrió. Si otra
          // sesión la cambia con el formulario abierto, el servidor compara con
          // la fecha actual y puede rechazar el guardado.
          isEdit
          submitLabel="Guardar cambios"
          onSubmit={async ({ date, note, assignedToId }) => {
            await updateReminder({
              id: reminder._id,
              expectedDate: reminder.date,
              date,
              note,
              assignedToId,
            });
            router.push(backHref);
          }}
          onCancel={() => router.push(backHref)}
        />
      </div>
    </div>
  );
}
