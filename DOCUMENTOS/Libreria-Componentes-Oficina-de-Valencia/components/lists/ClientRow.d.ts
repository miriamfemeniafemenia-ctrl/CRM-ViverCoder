import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Compact table row — client name and sale-pipeline status" viewport="480x220"
 */
export interface ClientRowProps {
  name: string;
  /** Matches StatusBadge domain="sale": interesado | presupuesto | cerrado | perdido */
  saleStatus?: string;
  /** D1's priority field (Mejora 1, 2026-06-30). Renders as a `StatusBadge domain="priority"` pill next to the sale-status badge; omit/undefined shows no priority badge. */
  priority?: "alta" | "media" | "baja";
  /** Optional second line under the name — e.g. "23 días sin contacto" (F9/F13, added 2026-07-22). Grows the row from the fixed 40px table height to an auto height with vertical padding; omit for the standard single-line P2 row. */
  subtitle?: string;
  /** Optional trailing slot (e.g. a compact Button) rendered after the badges — clicks inside it never bubble to the row's onClick. Added 2026-07-22 for F9/F13's per-row quick actions. */
  action?: React.ReactNode;
  /** Bottom hairline; set false on the last row of a list */
  divider?: boolean;
  onClick?: () => void;
}
