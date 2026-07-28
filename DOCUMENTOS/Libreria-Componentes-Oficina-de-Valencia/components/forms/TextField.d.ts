import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Labeled text input with focus ring and error state" viewport="360x140"
 */
export interface TextFieldProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Error message; also switches the border to the warning color */
  error?: string;
  disabled?: boolean;
  /** "password" renders a show/hide eye toggle inside the field automatically */
  type?: "text" | "email" | "tel" | "number" | "password";
}
