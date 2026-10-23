import { createClient } from "@/lib/supabase/server";
import type { Dream, DreamStatus } from "@/types/dreams";
import type { Visibility } from "@/types/world";

type Row = { id: string; title: string; description: string | null; target_date: string | null; status: DreamStatus;
  completed_at: string | null; visibility: Visibility; created_by: string };

/** RLS returns own dreams + the partner's shared ones. Only soft-deleted rows are excluded explicitly (creators still see their own). */
export async function getDreams(meId: string): Promise<Dream[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dreams")
    .select("id, title, description, target_date, status, completed_at, visibility, created_by")
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(200).returns<Row[]>();
  if (error) throw new Error("Dreams could not be loaded"); // -> friendly retryable error page
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, description: r.description, targetDate: r.target_date,
    status: r.status, completedAt: r.completed_at, visibility: r.visibility, byMe: r.created_by === meId }));
}
