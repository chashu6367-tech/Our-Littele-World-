import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WorldContext } from "@/types/world";

type ProfileRow = { id: string; display_name: string };
type WorldRow = { id: string; name: string; relationship_start_date: string | null; partner_one_id: string; partner_two_id: string };

/** For the authenticated world area. Redirects defensively (middleware already guards). */
export async function getWorldContext(): Promise<WorldContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: world, error } = await supabase.from("couple_worlds")
    .select("id, name, relationship_start_date, partner_one_id, partner_two_id").maybeSingle<WorldRow>();
  if (error) throw new Error("World lookup failed"); // a failed lookup is not "no world": fail closed with the retryable error page
  if (!world) redirect("/welcome");
  const partnerId = world.partner_one_id === user.id ? world.partner_two_id : world.partner_one_id;
  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", [user.id, partnerId]).returns<ProfileRow[]>();
  const name = (id: string) => profiles?.find((p) => p.id === id)?.display_name;
  return {
    me: { id: user.id, displayName: name(user.id) ?? "You" },
    partner: name(partnerId) ? { displayName: name(partnerId)! } : null,
    world: { id: world.id, name: world.name, relationshipStartDate: world.relationship_start_date },
  };
}
