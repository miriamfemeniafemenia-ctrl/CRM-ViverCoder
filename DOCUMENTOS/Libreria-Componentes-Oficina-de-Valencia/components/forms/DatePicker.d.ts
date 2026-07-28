import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Custom on-brand calendar popover, built on Popover" viewport="360x140"
 */
export interface DatePickerProps {
  label?: string;
  /** ISO date string (yyyy-mm-dd) */
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** ISO date strings bounding the selectable range */
  min?: string;
  max?: string;
}
