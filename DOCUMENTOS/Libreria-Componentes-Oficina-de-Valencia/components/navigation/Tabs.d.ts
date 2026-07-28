import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Underline tabs with optional count badges" viewport="480x80"
 */
export interface TabItem {
  key: string;
  label: string;
  /** Optional count badge, e.g. pending reminders for this tab */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  active?: string;
  onChange?: (key: string) => void;
}
