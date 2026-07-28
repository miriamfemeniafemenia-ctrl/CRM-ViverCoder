import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Primary, secondary and text buttons in standard and compact sizes" viewport="700x180"
 */
export interface ButtonProps {
  /** Visual weight: primary (filled, full pill — the one action signal), secondary (outlined, 8px radius), text (link-like) */
  variant?: "primary" | "secondary" | "text";
  /** Height: standard (40px) for most uses, compact (32px) for dense toolbars/table rows */
  size?: "standard" | "compact";
  /** Optional leading icon, rendered in currentColor before the label */
  icon?: "edit" | "save" | "back" | "add" | "search";
  disabled?: boolean;
  /** Shows a spinner in place of the icon and blocks interaction, without the grayed-out disabled look */
  loading?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
