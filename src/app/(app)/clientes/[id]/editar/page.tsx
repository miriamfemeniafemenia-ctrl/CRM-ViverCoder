import { ScreenPlaceholder } from "@/components/screen-placeholder";

// /clientes/[id]/editar — P4 en modo edición. Siempre cierra hacia P3 (regla de navegación del PRD).
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ScreenPlaceholder
      screen={`P4 — Editar cliente (${id})`}
      functions="F1 — Ficha de cliente"
      ticket="ARC-11, ARC-32 (prioridad), ARC-49 (Mejora 2), ARC-66 (CP)"
    />
  );
}
