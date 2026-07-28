import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="One person affected by a siniestro, inside its detail view — name + contact, edit/remove" viewport="480x180"
 */
export interface AffectedPartyRowProps {
  name: string;
  phone?: string;
  email?: string;
  divider?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}
