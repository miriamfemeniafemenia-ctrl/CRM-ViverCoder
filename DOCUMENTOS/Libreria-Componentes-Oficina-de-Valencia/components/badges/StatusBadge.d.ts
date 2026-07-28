import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Sale-pipeline, claim, priority and policy status pills, color-coded and mutually distinguishable" viewport="700x160"
 */
export interface StatusBadgeProps {
  /** Which state table to read from */
  domain?: "sale" | "claim" | "priority" | "policy";
  /** Must match a key in the chosen domain's table: sale → interesado | presupuesto | cerrado | perdido. claim → abierto | tramitacion | resuelto. priority → alta | media | baja. policy → activa | reemplazada | anulada */
  status?: string;
}
