import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Checkbox with label, focus ring and disabled state" viewport="280x80"
 */
export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}
