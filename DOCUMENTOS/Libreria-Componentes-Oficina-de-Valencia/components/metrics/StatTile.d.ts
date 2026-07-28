import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Single headline number for a KPI row — value + label, optional caption" viewport="280x160"
 */
export interface StatTileProps {
  /** Small tertiary-color label above the number, e.g. "Clientes activos" */
  label: string;
  /** The headline figure — pass a pre-formatted string/number, this component does not format it */
  value: string | number;
  /** Optional small tertiary line under the number, e.g. "+3 este mes" */
  caption?: string;
}
