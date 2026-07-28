import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Centered dialog with backdrop, header and optional footer" viewport="600x420"
 */
export interface ModalProps {
  open: boolean;
  title?: React.ReactNode;
  /** Called on backdrop click, Escape key, or the header close button */
  onClose?: () => void;
  children?: React.ReactNode;
  /** Right-aligned action row, e.g. Cancelar/Guardar buttons */
  footer?: React.ReactNode;
  /** Panel max-width in px */
  width?: number;
}
