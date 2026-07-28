import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Multi-line TextField for notes and descriptions" viewport="360x180"
 */
export interface TextAreaProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Visible rows before scrolling; the field can still be resized vertically */
  rows?: number;
}
