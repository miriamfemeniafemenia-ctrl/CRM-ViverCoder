"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ReminderForm } from "@/components/reminder-form";
import { api } from "../../../../../../../../convex/_generated/api";
import { Doc, Id } from "../../../../../../../../convex/_generated/dataModel";

// Destino de "volver" según el origen (?from=). Solo P1 lo añade; sin él (o con
// un valor desconocido) se vuelve a la ficha del cliente, que es desde donde
// se abre en P3.
const BACK_DESTINATION_BY_ORIGIN: Record<string, string> = {
  p1: "/",
};

// /clientes/[id]/recordatorios/[reminderId]/editar — "Nuevo recordatorio" en
// modo edición (ARC-61), abierto desde P1 o P3. Se puede guardar sin cambiar
// una fecha ya vencida.
export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reminderId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id, reminderId } = use(params);
  const { from } = use(searchParams);
  const router = useRouter();
  const clientHref = `/clientes/${id}`;
  const backHref = (from && BACK_DESTINATION_BY_ORIGIN[from]) || clientHref;

  const liveReminder = useQuery(api.reminders.get, {
    id: reminderId as Id<"reminders">,
  });
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
          originalDate={reminder.date}
          submitLabel="Guardar cambios"
          onSubmit={async ({ date, note, assignedToId }) => {
            await updateReminder({ id: reminder._id, date, note, assignedToId });
            router.push(backHref);
          }}
          onCancel={() => router.push(backHref)}
        />
      </div>
    </div>
  );
}
