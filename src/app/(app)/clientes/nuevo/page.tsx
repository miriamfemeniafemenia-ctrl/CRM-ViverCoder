"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { ClientForm } from "@/components/client-form";
import { emptyClientForm, initialAddressState } from "@/lib/client-form";
import { api } from "../../../../../convex/_generated/api";

// /clientes/nuevo — P4, alta de cliente nuevo (ARC-10/F1, ampliada en ARC-49
// con los campos de D1 y el autocompletado por código postal de ARC-66).
export default function Page() {
  const router = useRouter();
  const createClient = useMutation(api.clients.create);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-text-primary mb-6 text-2xl font-semibold">Nuevo cliente</h1>
        <ClientForm
          initialFields={emptyClientForm()}
          initialAddress={initialAddressState()}
          submitLabel="Guardar cliente"
          onSubmit={async (payload) => {
            const id = await createClient(payload);
            router.push(`/clientes/${id}`);
          }}
          onCancel={() => router.push("/clientes")}
        />
      </div>
    </div>
  );
}
