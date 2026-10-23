import { createClient } from "@/lib/supabase/server";
import type { LetterDetail, LetterSummary } from "@/types/letters";
import type { Visibility } from "@/types/world";

type Row = { id: string; title: string; body: string; visibility: Visibility; created_by: string; created_at: string };
const COLS = "id, title, body, visibility, created_by, created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCERPT_CHARS = 180;
// Cut on code points, not UTF-16 units: slice() could split an emoji and leave a broken character.
const excerpt = (body: string) => { const t = body.replace(/\s+/g, " ").trim(); const cps = Array.from(t); return cps.length > EXCERPT_CHARS ? `${cps.slice(0, EXCERPT_CHARS).join("").trimEnd()}…` : t; };

/** RLS returns own letters + the partner's shared ones. Only soft-deleted rows are excluded explicitly (creators still see their own). */
export async function getLetters(meId: string): Promise<LetterSummary[]> {
  const { data, error } = await (await createClient()).from("letters").select(COLS)
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(100).returns<Row[]>();
  if (error) throw new Error("Letters could not be loaded"); // -> friendly retryable error page
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, excerpt: excerpt(r.body), visibility: r.visibility, byMe: r.created_by === meId, writtenAt: r.created_at }));
}

/** null for missing / deleted / private-to-someone-else / malformed ids (indistinguishable on purpose). */
export async function getLetter(id: string, meId: string, partnerName: string, myName: string): Promise<LetterDetail | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await (await createClient()).from("letters").select(COLS).eq("id", id).is("deleted_at", null).maybeSingle<Row>();
  if (error || !data) return null;
  return { id: data.id, title: data.title, body: data.body, visibility: data.visibility, byMe: data.created_by === meId, writtenAt: data.created_at,
    creatorName: data.created_by === meId ? myName : partnerName };
}
