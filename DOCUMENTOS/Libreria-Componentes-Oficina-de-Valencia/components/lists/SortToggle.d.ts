import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Sortable column label — click to toggle ascending/descending" viewport="220x80"
 */
export interface SortToggleProps {
  /** The field this control sorts by, e.g. "Prioridad" or "Días sin contacto" */
  label: string;
  /** Current direction for this field; null/undefined renders the neutral (not-the-active-sort) state */
  direction?: "asc" | "desc" | null;
  onToggle?: () => void;
}
