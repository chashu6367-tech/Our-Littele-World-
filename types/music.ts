import type { Visibility } from "./world";
export interface Song {
  id: string; title: string; artist: string | null; notes: string | null;
  /** Stored value, only used to prefill the edit form. */
  externalUrl: string | null;
  /** Validated, safe-to-open link (null when absent or when the stored value fails validation). */
  link: { url: string; host: string } | null;
  visibility: Visibility; byMe: boolean;
}
