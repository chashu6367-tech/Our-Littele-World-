import { createClient } from "@/lib/supabase/server";
import type { HomePreview, PreviewItem, Visibility } from "@/types/world";

type Row = { id: string; title: string; visibility: Visibility; created_by: string };
type MemoryRow = Row & { memory_date: string | null };
type MilestoneRow = Row & { milestone_date: string };
type DreamRow = Row & { target_date: string | null };

const item = (r: Row, date: string | null, meId: string): PreviewItem =>
  ({ id: r.id, title: r.title, date, visibility: r.visibility, byMe: r.created_by === meId });

/**
 * Home previews. Privacy is enforced by RLS (own rows + partner's shared rows); there is no world_id
 * or user filter here because the database derives both from the session. Only soft-deleted rows are
 * excluded explicitly, since a creator can still see their own deleted rows.
 */
export async function getHomePreview(meId: string): Promise<HomePreview> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [mem, ms, dr] = await Promise.all([
    supabase.from("memories").select("id, title, memory_date, visibility, created_by").is("deleted_at", null)
      .order("memory_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(3).returns<MemoryRow[]>(),
    supabase.from("milestones").select("id, title, milestone_date, visibility, created_by").gte("milestone_date", today)
      .order("milestone_date", { ascending: true }).limit(3).returns<MilestoneRow[]>(),
    supabase.from("dreams").select("id, title, target_date, visibility, created_by").neq("status", "achieved").is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(3).returns<DreamRow[]>(),
  ]);
  if (mem.error || ms.error || dr.error) throw new Error("Home preview could not be loaded"); // -> friendly error boundary
  const memories = (mem.data ?? []).map((r) => item(r, r.memory_date, meId));
  const milestones = (ms.data ?? []).map((r) => item(r, r.milestone_date, meId));
  const dreams = (dr.data ?? []).map((r) => item(r, r.target_date, meId));
  return { memories, milestones, dreams, isEmpty: !memories.length && !milestones.length && !dreams.length };
}
