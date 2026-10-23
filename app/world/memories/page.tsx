import { getWorldContext } from "@/lib/data/world";
import { getMemories } from "@/lib/data/memories";
import { MemoriesView } from "@/features/memories/MemoriesView";

export default async function MemoriesPage() {
  const ctx = await getWorldContext();
  const memories = await getMemories(ctx.me.id);
  return <MemoriesView memories={memories} partner={ctx.partner?.displayName ?? "Your partner"} />;
}
