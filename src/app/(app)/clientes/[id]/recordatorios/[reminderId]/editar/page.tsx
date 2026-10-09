"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ReminderForm } from "@/components/reminder-form";
import { api } from "../../../../../../../../convex/_generated/api";
import { Doc } from "../../../../../../../../convex/_generated/dataModel";

// /clientes/[id]/recordatorios/[reminderId]/editar — "Nuevo recordatorio" en
// modo edición (ARC-61), abierto desde P3 o P1 (ARC-70, ?from=p1). Se puede
// guardar sin cambiar una fecha ya vencida.
export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reminderId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { id, reminderId } = use(params);
  // Next entrega `string | string[] | undefined` (un parámetro repetido en
  // la URL da un array); nos quedamos con el primer valor.
  const rawFrom = use(searchParams).from;
  const from = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom;
  const router = useRouter();
  const clientHref = `/clientes/${id}`;
  // Comparación directa, sin un Record indexado por `from`: una clave como
  // "constructor" en un Record cae en Object.prototype y backHref deja de ser
  // un string (bug real en la primera versión de este archivo, ARC-61).
  const backHref = from === "p1" ? "/" : clientHref;

  const liveReminder = useQuery(api.reminders.get, { id: reminderId });
  // Copia de lo cargado la primera vez: si otra sesión borra el recordatorio
  // con el formulario abierto, no se desmonta y el guardado devuelve el error
  // "El recordatorio no existe" en vez de perder lo escrito.
  const [loadedReminder, setLoadedReminder] = useState<Doc<"reminders"> | null>(null);
  if (liveReminder && !loadedReminder) {
    setLoadedReminder(liveReminder);
  }
  const reminder = loadedReminder ?? liveReminder;
  const updateReminder = useMutation(api.reminders.update);

  if (reminder === undefined) {
    return (
      <div className="flex min-h-full flex-1 flex-col p-6">
        <p className="text-text-tertiary text-sm">Cargando…</p>
      </div>
    );
  }

  // Un recordatorio de otro cliente no se edita bajo la URL de este.
  if (reminder === null || reminder.clientId !== id) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-3 p-6">
        <p className="text-text-secondary text-sm">No se encontró este recordatorio.</p>
        <Link href={backHref} className="text-text-link text-sm">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">
          Editar recordatorio
        </h1>

        <ReminderForm
          initialDate={reminder.date}
          initialNote={reminder.note}
          initialAssignedToId={reminder.assignedToId}
          // Se envían fecha, nota y responsable con los que se abrió el
          // formulario (ARC-71). `reminder` es la instantánea de apertura, no
          // `liveReminder`: no derivar los valores esperados de datos reactivos,
          // o el servidor nunca vería el conflicto.
          isEdit
          submitLabel="Guardar cambios"
          onSubmit={async ({ date, note, assignedToId }) => {
            await updateReminder({
              id: reminder._id,
              expectedDate: reminder.date,
              expectedNote: reminder.note,
              expectedAssignedToId: reminder.assignedToId,
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
