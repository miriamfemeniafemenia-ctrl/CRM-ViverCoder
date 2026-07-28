import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Mobile sheet sliding from the bottom, with drag handle and backdrop" viewport="400x520"
 */
export interface BottomSheetProps {
  open: boolean;
  title?: React.ReactNode;
  /** Called on backdrop click or Escape key (there's no header close button — the drag handle signals the dismiss affordance) */
  onClose?: () => void;
  children?: React.ReactNode;
  /** Right-aligned action row, e.g. Cancelar/Guardar buttons */
  footer?: React.ReactNode;
}
