import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Card with optional header, title and trailing action" viewport="420x220"
 */
export interface SectionCardProps {
  title?: React.ReactNode;
  /** Rendered top-right of the header, e.g. a compact Button or text link */
  action?: React.ReactNode;
  children?: React.ReactNode;
}
