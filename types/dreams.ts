import type { Visibility } from "./world";
/** Database enum `dream_status`. UI "Completed" = `achieved`. `dreaming` is a legacy value the UI never writes. */
export type DreamStatus = "dreaming" | "planned" | "in_progress" | "achieved";
export interface Dream {
  id: string; title: string; description: string | null; targetDate: string | null;
  status: DreamStatus; completedAt: string | null; visibility: Visibility; byMe: boolean;
}
