"use client";

import { useQuery } from "convex/react";
import { useTodayMadrid } from "@/lib/use-today-madrid";
import { api } from "../../convex/_generated/api";

// Número de recordatorios vencidos o de hoy del usuario conectado (ARC-65), para
// la insignia del menú. Pide solo el número al servidor (`countDueByAssignee`),
// sin llevar recordatorios al navegador. `today` viene de `useTodayMadrid`, que
// se recalcula a medianoche y al volver la pestaña a primer plano: al cambiar el
// día la query se vuelve a pedir sola. `undefined` mientras carga.
export function useDueCount() {
  const today = useTodayMadrid();
  return useQuery(api.reminders.countDueByAssignee, { today });
}
