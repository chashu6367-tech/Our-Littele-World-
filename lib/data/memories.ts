import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_BUCKET, SIGNED_URL_SECONDS } from "@/lib/memories/media";
import type { MemoryDetail, MemorySummary } from "@/types/memories";

type MemRow = { id: string; title: string; description: string | null; memory_date: string | null; location: string | null; visibility: "shared" | "private"; created_by: string };
type MediaRow = { id: string; memory_id: string; storage_path: string; media_type: "image" | "video"; file_name: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Short-lived signed URLs. Signing itself is gated by the storage SELECT policy (memory visibility + not deleted). */
async function sign(supabase: SupabaseClient, paths: string[]) {
  const urls = new Map<string, string>();
  if (!paths.length) return urls;
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  data?.forEach((d) => { if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl); });
  return urls;
}

/** Everything is RLS-filtered: own memories + the partner's shared ones. Only soft-deleted rows are excluded explicitly. */
export async function getMemories(meId: string): Promise<MemorySummary[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("memories").select("id, title, memory_date, location, visibility, created_by")
    .is("deleted_at", null).order("memory_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false }).limit(60).returns<Omit<MemRow, "description">[]>();
  if (error) throw new Error("Memories could not be loaded"); // -> friendly error boundary
  if (!rows?.length) return [];
  const { data: media, error: mErr } = await supabase.from("memory_media").select("id, memory_id, storage_path, media_type, file_name")
    .in("memory_id", rows.map((r) => r.id)).is("deleted_at", null).order("created_at", { ascending: true }).returns<MediaRow[]>();
  if (mErr) throw new Error("Memories could not be loaded");
  const firstImage = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const m of media ?? []) {
    counts.set(m.memory_id, (counts.get(m.memory_id) ?? 0) + 1);
    if (m.media_type === "image" && !firstImage.has(m.memory_id)) firstImage.set(m.memory_id, m.storage_path);
  }
  const urls = await sign(supabase, [...firstImage.values()]);
  return rows.map((r) => ({
    id: r.id, title: r.title, date: r.memory_date, location: r.location, visibility: r.visibility,
    byMe: r.created_by === meId, mediaCount: counts.get(r.id) ?? 0, cover: urls.get(firstImage.get(r.id) ?? "") ?? null,
  }));
}

/** null for: bad id, missing, deleted, or not visible to the caller: the caller cannot tell these apart. */
export async function getMemory(id: string, meId: string, partnerName: string): Promise<MemoryDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: m, error } = await supabase.from("memories").select("id, title, description, memory_date, location, visibility, created_by")
    .eq("id", id).is("deleted_at", null).maybeSingle<MemRow>();
  if (error || !m) return null;
  const { data: media } = await supabase.from("memory_media").select("id, memory_id, storage_path, media_type, file_name")
    .eq("memory_id", id).is("deleted_at", null).order("created_at", { ascending: true }).returns<MediaRow[]>();
  const urls = await sign(supabase, (media ?? []).map((x) => x.storage_path));
  const byMe = m.created_by === meId;
  return {
    id: m.id, title: m.title, description: m.description, date: m.memory_date, location: m.location, visibility: m.visibility,
    byMe, creatorName: byMe ? "You" : partnerName,
    media: (media ?? []).flatMap((x) => urls.has(x.storage_path)
      ? [{ id: x.id, kind: x.media_type, url: urls.get(x.storage_path)!, path: x.storage_path, fileName: x.file_name }] : []),
  };
}
