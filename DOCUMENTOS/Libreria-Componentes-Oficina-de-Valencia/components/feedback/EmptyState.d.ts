import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Icon + message for lists with no content" viewport="700x220"
 */
export interface EmptyStateProps {
  icon?: "check" | "search" | "claim";
  message?: string;
  /** Optional CTA rendered below the message, e.g. a "Nuevo cliente" Button */
  action?: React.ReactNode;
}
