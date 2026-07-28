import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Reminder card for P1 — Mis tareas de hoy, with overdue state and inline actions" viewport="480x420"
 */
export interface ReminderItemProps {
  clientName: string;
  /** Pre-formatted date string, e.g. "17 jul" */
  date?: string;
  /** Why this reminder exists */
  note?: string;
  /** Who it's assigned to (D3, updated 2026-07-16) — e.g. "Antonio". Appended after the date ("22 jul · Antonio"); omit in views already filtered to one person. Added 2026-07-22 to close a PRD-audit gap: a combined view showing every person's reminders together had no way to tell them apart. */
  assignedTo?: string;
  /** Switches to the warning treatment (left accent, warning-colored date) */
  overdue?: boolean;
  /** Renders the item muted with a struck-through client name */
  done?: boolean;
  /** Click anywhere on the item (outside the action icons) to open the client's ficha */
  onClick?: () => void;
  /** Check icon — mark the reminder as done */
  onComplete?: () => void;
  /** Pencil icon — opens the "Nuevo/editar recordatorio" form pre-filled */
  onEdit?: () => void;
  /** Trash icon — deletes the reminder */
  onDelete?: () => void;
}
