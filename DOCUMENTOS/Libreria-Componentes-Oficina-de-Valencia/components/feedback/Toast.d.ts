import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Bottom-centered confirmation/error message" viewport="480x160"
 */
export interface ToastProps {
  open: boolean;
  message: string;
  /** neutral: dark confirmation (save, delete...). error: reuses the same warning tokens as form errors */
  variant?: "neutral" | "error";
  /** Auto-dismiss after this many ms; omit to require manual dismissal via onClose */
  duration?: number;
  onClose?: () => void;
}
