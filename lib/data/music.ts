import { createClient } from "@/lib/supabase/server";
import { safeSongUrl } from "@/lib/music/url";
import type { Song } from "@/types/music";
import type { Visibility } from "@/types/world";

type Row = { id: string; title: string; artist: string | null; external_url: string | null; description: string | null; visibility: Visibility; created_by: string };

/** RLS returns own songs + the partner's shared ones. Only soft-deleted rows are excluded explicitly (creators still see their own). */
export async function getSongs(meId: string): Promise<Song[]> {
  const { data, error } = await (await createClient()).from("songs")
    .select("id, title, artist, external_url, description, visibility, created_by")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(200).returns<Row[]>();
  if (error) throw new Error("Songs could not be loaded"); // -> friendly retryable error page
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, artist: r.artist, notes: r.description, externalUrl: r.external_url,
    link: safeSongUrl(r.external_url), visibility: r.visibility, byMe: r.created_by === meId }));
}
