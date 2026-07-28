import * as React from "react";

/**
 * @startingPoint section="Components" subtitle="Side nav (desktop) / bottom nav (mobile), same active-state logic" viewport="900x420"
 */
export interface MainNavProps {
  active?: "tasks" | "clients" | "leads" | "claims" | "summary" | "unfollowed" | null;
  onNavigate?: (key: string) => void;
  /** "auto" renders both and lets CSS decide; force one for isolated previews */
  mode?: "auto" | "desktop" | "mobile";
  /** Pending-count badge per nav item, e.g. { tasks: 3 }. Omitted/0 renders no badge. */
  counts?: Partial<Record<"tasks" | "clients" | "leads" | "claims" | "summary" | "unfollowed", number>>;
}
