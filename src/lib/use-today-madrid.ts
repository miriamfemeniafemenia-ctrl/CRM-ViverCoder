"use client";

import { useEffect, useState } from "react";
import { todayISODateMadrid, watchMadridDay } from "@/lib/reminders";

// «Hoy» en Madrid como estado, recalculado con `watchMadridDay` (medianoche y
// vuelta a primer plano). `setToday` con el mismo valor no provoca otro render,
// y la limpieza del efecto cancela temporizador y listener (Strict Mode).
export function useTodayMadrid() {
  const [today, setToday] = useState(todayISODateMadrid);
  useEffect(() => watchMadridDay(() => setToday(todayISODateMadrid())), []);
  return today;
}
