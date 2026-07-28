import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Compact row for a client's contracted policy — type, insurer, number and status" viewport="480x220"
 */
export interface PolicyRowProps {
  /** e.g. "Seguro de auto" */
  policyType: string;
  /** Insurance company name */
  insurer?: string;
  policyNumber?: string;
  /** Matches StatusBadge domain="policy": activa | reemplazada | anulada */
  policyStatus?: string;
  divider?: boolean;
  onClick?: () => void;
}
