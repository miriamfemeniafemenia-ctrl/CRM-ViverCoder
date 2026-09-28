import { ScreenPlaceholder } from "@/components/screen-placeholder";

// Route por defecto ("/") — P1 según ARC-8.
export default function Page() {
  return (
    <ScreenPlaceholder
      screen="P1 — Mis tareas de hoy"
      functions="F5 — Recordatorios"
      ticket="ARC-17, ARC-35, ARC-58, ARC-60…65"
    />
  );
}
