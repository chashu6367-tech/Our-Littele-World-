import { notFound } from "next/navigation";
import { getWorldContext } from "@/lib/data/world";
import { getMemory } from "@/lib/data/memories";
import { MemoryDetailView } from "@/features/memories/MemoryDetailView";

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorldContext();
  const memory = await getMemory(id, ctx.me.id, ctx.partner?.displayName ?? "Your partner");
  if (!memory) notFound(); // identical for missing / deleted / private-to-someone-else / malformed
  return <MemoryDetailView memory={memory} worldId={ctx.world.id} meId={ctx.me.id} />;
}
