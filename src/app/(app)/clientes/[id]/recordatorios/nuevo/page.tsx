"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { ReminderForm } from "@/components/reminder-form";
import { api } from "../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../convex/_generated/dataModel";

// /clientes/[id]/recordatorios/nuevo — sub-pantalla "Nuevo recordatorio"
// (ARC-15), abierta desde P3. Incluye el selector de usuario asignado
// (ARC-60), con la persona conectada como valor por defecto.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const router = useRouter();
  const backHref = `/clientes/${clientId}`;

  const createReminder = useMutation(api.reminders.create);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">
          Nuevo recordatorio
        </h1>

        <ReminderForm
          submitLabel="Guardar recordatorio"
          onSubmit={async ({ date, note, assignedToId }) => {
            await createReminder({ clientId, date, note, assignedToId });
            router.push(backHref);
          }}
          onCancel={() => router.push(backHref)}
        />
      </div>
    </div>
  );
}
