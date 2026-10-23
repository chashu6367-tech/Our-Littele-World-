import type { Visibility } from "./world";
export interface LetterSummary {
  id: string; title: string;
  /** First part of the body only; the full text is loaded on the reading page. */
  excerpt: string;
  visibility: Visibility; byMe: boolean;
  /** ISO timestamp of when the letter was written. */
  writtenAt: string;
}
export interface LetterDetail extends Omit<LetterSummary, "excerpt"> { body: string; creatorName: string }
