export interface WorldContext {
  me: { id: string; displayName: string };
  partner: { displayName: string } | null;
  world: { id: string; name: string; relationshipStartDate: string | null };
}

export type Visibility = "shared" | "private";
/** A lightweight Home preview row. Rows come from RLS-filtered queries; nothing is filtered client-side for privacy. */
export interface PreviewItem { id: string; title: string; date: string | null; visibility: Visibility; byMe: boolean }
export interface HomePreview { memories: PreviewItem[]; milestones: PreviewItem[]; dreams: PreviewItem[]; isEmpty: boolean }
