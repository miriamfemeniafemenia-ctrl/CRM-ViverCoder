"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { ContactForm } from "@/components/contact-form";
import { api } from "../../../../../convex/_generated/api";

// Origen desde el que se abrió la ventana (regla de navegación ARC-8: "volver"
// debe llevar al origen correcto). Hoy solo la ficha de cliente enlaza aquí;
// cualquier otro valor cae en el destino por defecto.
const DEFAULT_BACK_DESTINATION = "/clientes";

// /interacciones/nueva — "Anotar interacción" (ARC-72). `?clientId=` es
// opcional y NO es de fiar (viene de la URL): lo resuelve el backend
// (clients.lookup) y, si está repetido, malformado o no existe, no se
// prefija nada ni se crea nada.
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string | string[]; from?: string | string[] }>;
}) {
  const { clientId: rawClientId, from: rawFrom } = use(searchParams);
  const router = useRouter();
  const createContact = useMutation(api.contacts.create);

  // Un parámetro repetido (?clientId=a&clientId=b) es ambiguo: se trata como
  // inválido en vez de elegir uno.
  const clientIdParam = typeof rawClientId === "string" ? rawClientId : undefined;
  const clientIdInvalid = rawClientId !== undefined && clientIdParam === undefined;
  const lookedUp = useQuery(
    api.clients.lookup,
    clientIdParam === undefined ? "skip" : { id: clientIdParam },
  );

  // Solo la ficha de un cliente existente es un origen válido para "volver".
  const fromClientId = typeof rawFrom === "string" ? rawFrom : undefined;
  const backHref = lookedUp && fromClientId === lookedUp._id
    ? `/clientes/${lookedUp._id}`
    : DEFAULT_BACK_DESTINATION;

  const waitingForClient = clientIdParam !== undefined && lookedUp === undefined;
  const clientNotFound = clientIdInvalid || (clientIdParam !== undefined && lookedUp === null);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">Anotar interacción</h1>

        {clientNotFound && (
          <div className="border-warning-border bg-warning-bg mb-4 flex flex-col gap-1 rounded-md border px-4 py-3">
            <span className="text-warning-fg text-sm">
              No se encontró este cliente. Busca otro o da de alta uno nuevo.
            </span>
            <Link href={backHref} className="text-text-link text-sm">
              Volver
            </Link>
          </div>
        )}

        {waitingForClient ? (
          <p className="text-text-tertiary text-sm">Cargando…</p>
        ) : (
          <ContactForm
            // Si el cliente prefijado llega después del primer render, el
            // formulario se monta ya con él en vez de arrancar vacío.
            key={lookedUp?._id ?? "sin-cliente"}
            initialClient={
              lookedUp
                ? { _id: lookedUp._id, name: lookedUp.name, phone: lookedUp.phone }
                : undefined
            }
            onSubmit={async (values) => {
              const { clientId } = await createContact(values);
              router.push(`/clientes/${clientId}`);
            }}
            onCancel={() => router.push(backHref)}
          />
        )}
      </div>
    </div>
  );
}
