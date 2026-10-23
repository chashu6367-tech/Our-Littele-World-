import { CheckCircle2, CircleDashed, Compass, Sparkles, type LucideIcon } from "lucide-react";
import type { DreamStatus } from "@/types/dreams";

export const STATUS_META: Record<DreamStatus, { label: string; icon: LucideIcon; chip: string }> = {
  dreaming:    { label: "Dreaming",    icon: Sparkles,     chip: "bg-cream text-muted" },
  planned:     { label: "Planned",     icon: CircleDashed, chip: "bg-cream text-gold" },
  in_progress: { label: "In progress", icon: Compass,      chip: "bg-blush text-rose" },
  achieved:    { label: "Completed",   icon: CheckCircle2, chip: "bg-ink text-paper" },
};
/** Statuses a person can choose in the form (never the legacy `dreaming`). */
export const CHOOSABLE: DreamStatus[] = ["planned", "in_progress", "achieved"];
/** Display order of the groups on the page. */
export const GROUPS: { title: string; statuses: DreamStatus[] }[] = [
  { title: "In progress", statuses: ["in_progress"] },
  { title: "Planned", statuses: ["planned", "dreaming"] },
  { title: "Completed", statuses: ["achieved"] },
];
/** completed_at must be set exactly when status is `achieved` (database CHECK). */
export const completedAtFor = (status: DreamStatus, existing: string | null) =>
  status === "achieved" ? existing ?? new Date().toISOString() : null;
