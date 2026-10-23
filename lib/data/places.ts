import { createClient } from "@/lib/supabase/server";
import { PLACE_BUCKET } from "@/lib/places/media";
import { SIGNED_URL_SECONDS } from "@/lib/memories/media";
import type { PlaceDetail, PlaceSummary } from "@/types/places";
import type { Visibility } from "@/types/world";

type Row = { id: string; name: string; description: string | null; location_text: string | null; is_visited: boolean; visit_date: string | null;
  visibility: Visibility; created_by: string; cover_path: string | null };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS = "id, name, description, location_text, is_visited, visit_date, visibility, created_by, cover_path";

/** Short-lived signed URLs; signing is itself gated by the storage SELECT policy (place visibility + not deleted). */
async function signCovers(paths: string[]) {
  const urls = new Map<string, string>();
  if (!paths.length) return urls;
  const { data } = await (await createClient()).storage.from(PLACE_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  data?.forEach((d) => { if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl); });
  return urls;
}
const summary = (r: Row, meId: string, urls: Map<string, string>): PlaceSummary => ({
  id: r.id, name: r.name, locationText: r.location_text, visited: r.is_visited, visitDate: r.visit_date,
  visibility: r.visibility, byMe: r.created_by === meId, cover: (r.cover_path && urls.get(r.cover_path)) || null });

/** RLS returns own places + the partner's shared ones. Only soft-deleted rows are excluded explicitly (creators still see their own). */
export async function getPlaces(meId: string): Promise<PlaceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("places").select(COLS).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(100).returns<Row[]>();
  if (error) throw new Error("Places could not be loaded"); // -> friendly error boundary
  const rows = data ?? [];
  const urls = await signCovers(rows.map((r) => r.cover_path).filter((p): p is string => !!p));
  return rows.map((r) => summary(r, meId, urls));
}

/** null for missing / deleted / private-to-someone-else / malformed ids (indistinguishable on purpose). */
export async function getPlace(id: string, meId: string, partnerName: string, myName: string): Promise<PlaceDetail | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await (await createClient()).from("places").select(COLS).eq("id", id).is("deleted_at", null).maybeSingle<Row>();
  if (error || !data) return null;
  const urls = await signCovers(data.cover_path ? [data.cover_path] : []);
  return { ...summary(data, meId, urls), description: data.description, coverPath: data.cover_path,
    creatorName: data.created_by === meId ? myName : partnerName };
}
