import { getWorldContext } from "@/lib/data/world";
import { getDreams } from "@/lib/data/dreams";
import { DreamsView } from "@/features/dreams/DreamsView";

export default async function DreamsPage() {
  const ctx = await getWorldContext();
  const dreams = await getDreams(ctx.me.id);
  return <DreamsView dreams={dreams} worldId={ctx.world.id} meId={ctx.me.id} partner={ctx.partner?.displayName ?? "Your partner"} />;
}
