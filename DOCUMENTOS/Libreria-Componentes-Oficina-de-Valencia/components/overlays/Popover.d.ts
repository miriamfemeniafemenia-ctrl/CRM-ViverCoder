import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Anchored floating panel for menus and filter controls" viewport="360x220"
 */
export interface PopoverProps {
  /** The element that toggles the popover on click — typically a Button or icon button. Click handling is attached to a wrapping span, so the trigger itself doesn't need its own onClick. */
  trigger: React.ReactNode;
  children?: React.ReactNode;
  /** Which edge of the trigger the panel's edge aligns to */
  align?: "start" | "end";
  /** Panel min-width in px (default 180) */
  width?: number;
  /** Controlled open state — omit to let Popover manage its own state */
  open?: boolean;
  /** Fires on every open/close, whether controlled or not */
  onOpenChange?: (open: boolean) => void;
}
