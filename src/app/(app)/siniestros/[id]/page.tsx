import { ScreenPlaceholder } from "@/components/screen-placeholder";

// /siniestros/[id] — Ficha de siniestro (detalle con partes afectadas y notas, Mejora 4).
// Accesible también desde P3.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ScreenPlaceholder
      screen={`Ficha de siniestro (${id})`}
      functions="F10 — Siniestro en ficha de cliente"
      ticket="ARC-54 (datos), ARC-55 (pantalla), ARC-56 (enlace)"
    />
  );
}
