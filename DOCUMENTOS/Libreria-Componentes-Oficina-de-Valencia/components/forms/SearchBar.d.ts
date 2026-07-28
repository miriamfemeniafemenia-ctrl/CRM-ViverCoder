import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Standalone search input with leading icon and clear button" viewport="360x100"
 */
export interface SearchBarProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}
