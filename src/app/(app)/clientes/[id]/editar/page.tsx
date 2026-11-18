"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { ClientForm } from "@/components/client-form";
import {
  clientToForm,
  clientVersion,
  initialAddressState,
  PinnedClient,
  pinnedForRoute,
} from "@/lib/client-form";
import { api } from "../../../../../../convex/_generated/api";

// /clientes/[id]/editar — P4 en modo edición (ARC-11, con los campos de
// ARC-49 y el código postal de ARC-66). Siempre cierra hacia P3 (regla de
// navegación del PRD), al guardar y al cancelar. Edita también la prioridad
// (ARC-32); el estado de venta no.
//
// El `id` llega de la URL y puede estar mal escrito: primero se valida con
// `clients.lookup` (acepta texto y devuelve null si no es un cliente) y solo
// con un id válido se pide el documento completo a `clients.get`.
//
// Control de ediciones simultáneas: el formulario se fija UNA vez con el
// cliente y su versión (`updatedAt ?? createdAt`), atado al id de la ruta. Los
// cambios en vivo de la consulta no pisan lo que se está escribiendo; si otra
// persona guardó antes, el servidor lo rechaza y «Descartar mis cambios y
// recargar» vuelve a fijar el formulario con los datos actuales.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const found = useQuery(api.clients.lookup, { id });
  const live = useQuery(api.clients.get, found ? { id: found._id } : "skip");
  const updateClient = useMutation(api.clients.update);
  const [pinnedState, setPinnedState] = useState<PinnedClient>(null);

  // Ajuste de estado durante el render (sin efecto): fija el cliente de ESTA
  // ruta la primera vez que llega, y descarta el de otra ruta.
  const pinned = pinnedForRoute(pinnedState, id, live);
  if (pinned !== pinnedState) {
    setPinnedState(pinned);
  }

  const backToClient = () => router.push(`/clientes/${id}`);

  if (found === null || live === null) {
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

  const client = pinned.client;
  const version = clientVersion(client);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <Link href={`/clientes/${client._id}`} className="text-text-link mb-4 inline-block text-sm">
          ← {client.name}
        </Link>
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">Editar cliente</h1>
        <ClientForm
          // Otro cliente u otra versión → otro formulario (se descarta lo escrito).
          key={`${client._id}:${version}`}
          initialFields={clientToForm(client)}
          initialAddress={initialAddressState(client.address)}
          submitLabel="Guardar cambios"
          onSubmit={async (payload) => {
            await updateClient({ id: client._id, expectedVersion: version, ...payload });
            router.push(`/clientes/${client._id}`);
          }}
          onCancel={backToClient}
          onDiscardAndReload={() => {
            if (live && live._id === id) setPinnedState({ routeId: id, client: live });
          }}
        />
      </div>
    </div>
  );
}
