import type { Visibility } from "./world";
export interface MemoryMediaItem { id: string; kind: "image" | "video"; url: string; path: string; fileName: string }
export interface MemorySummary {
  id: string; title: string; date: string | null; location: string | null; visibility: Visibility;
  byMe: boolean; cover: string | null; mediaCount: number;
}
export interface MemoryDetail {
  id: string; title: string; description: string | null; date: string | null; location: string | null;
  visibility: Visibility; byMe: boolean; creatorName: string; media: MemoryMediaItem[];
}
