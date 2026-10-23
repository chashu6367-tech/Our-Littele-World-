import type { Visibility } from "./world";
export interface PlaceSummary {
  id: string; name: string; locationText: string | null; visited: boolean; visitDate: string | null;
  visibility: Visibility; byMe: boolean; cover: string | null;
}
export interface PlaceDetail extends PlaceSummary { description: string | null; creatorName: string; coverPath: string | null }
