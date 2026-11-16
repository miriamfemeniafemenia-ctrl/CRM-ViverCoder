"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ClientForm } from "@/components/client-form";
import { clientToForm, clientVersion, initialAddressState } from "@/lib/client-form";
import { api } from "../../../../../../convex/_generated/api";
import { Doc, Id } from "../../../../../../convex/_generated/dataModel";

// /clientes/[id]/editar — P4 en modo edición (ARC-11, con los campos de
// ARC-49 y el código postal de ARC-66). Siempre cierra hacia P3 (regla de
// navegación del PRD), al guardar y al cancelar. No edita el estado de venta ni
// la prioridad (se gestionan en P3).
//
// Control de ediciones simultáneas: el formulario se fija UNA vez con el
// cliente y su versión (`updatedAt ?? createdAt`). Los cambios en vivo de la
// consulta no pisan lo que se está escribiendo; si otra persona guardó antes,
// el servidor lo rechaza y «Descartar mis cambios y recargar» vuelve a fijar el
// formulario con los datos actuales.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clientId = id as Id<"clients">;
  const router = useRouter();
  const client = useQuery(api.clients.get, { id: clientId });
  const updateClient = useMutation(api.clients.update);
  const [pinned, setPinned] = useState<Doc<"clients"> | null>(null);

  // Fijar el cliente la primera vez que llega (ajuste de estado durante el
  // render, sin efecto).
  if (client && pinned === null) {
    setPinned(client);
  }

  const backToClient = () => router.push(`/clientes/${clientId}`);

  if (client === null) {
    return (
      <div className="flex min-h-full flex-1 flex-col gap-3 p-6">
        <p className="text-text-secondary text-sm">No se encontró este cliente.</p>
        <Link href="/clientes" className="text-text-link text-sm">
          Volver a la lista de clientes
        </Link>
      </div>
    );
  }

  if (pinned === null) {
    return (
      <div className="flex min-h-full flex-1 flex-col p-6">
        <p className="text-text-tertiary text-sm">Cargando…</p>
      </div>
    );
  }

  const version = clientVersion(pinned);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <Link href={`/clientes/${clientId}`} className="text-text-link mb-4 inline-block text-sm">
          ← {pinned.name}
        </Link>
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">Editar cliente</h1>
        <ClientForm
          // Otra versión → otro formulario (se descarta lo escrito).
          key={version}
          initialFields={clientToForm(pinned)}
          initialAddress={initialAddressState(pinned.address)}
          submitLabel="Guardar cambios"
          onSubmit={async (payload) => {
            await updateClient({ id: clientId, expectedVersion: version, ...payload });
            backToClient();
          }}
          onCancel={backToClient}
          onDiscardAndReload={() => {
            if (client) setPinned(client);
          }}
        />
      </div>
    </div>
  );
}
