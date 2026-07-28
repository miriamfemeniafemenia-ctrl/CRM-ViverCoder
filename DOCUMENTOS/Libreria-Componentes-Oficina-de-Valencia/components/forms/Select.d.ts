import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Labeled dropdown with the same focus/error treatment as TextField" viewport="360x140"
 */
export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  /** Shown as a disabled, hidden first option when no value is selected */
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}
