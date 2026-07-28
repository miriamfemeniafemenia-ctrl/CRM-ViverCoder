import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Compact table row — affected client, claim type and status" viewport="480x220"
 */
export interface ClaimRowProps {
  clientName: string;
  /** Free-text claim type, e.g. "Daño por agua" */
  claimType?: string;
  /** Matches StatusBadge domain="claim": abierto | tramitacion | resuelto */
  claimStatus?: string;
  /** Bottom hairline; set false on the last row of a list */
  divider?: boolean;
  onClick?: () => void;
}
