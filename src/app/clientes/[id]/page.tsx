import { ScreenPlaceholder } from "@/components/screen-placeholder";

// /clientes/[id] — P3, ficha de cliente. `params` es async (Next.js 16).
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ScreenPlaceholder
      screen={`P3 — Ficha de cliente (${id})`}
      functions="F1, F3, F4, F7, F8, F10"
      ticket="ARC-12, ARC-14, ARC-16, ARC-18, ARC-19, ARC-21, ARC-33, ARC-50, ARC-52, ARC-56"
    />
  );
}
