import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Timeline entry for a client's contact history (D2)" viewport="480x260"
 */
export interface ContactHistoryItemProps {
  /** Contact channel: llamada | whatsapp | correo | redes | web */
  type?: "llamada" | "whatsapp" | "correo" | "redes" | "web";
  /** What was said/agreed during the contact */
  note?: string;
  /** Pre-formatted date/time string, e.g. "17 jul, 10:24" */
  datetime?: string;
  /** Team member who logged the contact */
  author?: string;
  /** Bottom hairline; set false on the last item of a list */
  divider?: boolean;
}
