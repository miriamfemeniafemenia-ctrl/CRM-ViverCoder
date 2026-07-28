import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Selectable pill filter — inactive/active/hover states" viewport="420x60"
 */
export interface FilterChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}
