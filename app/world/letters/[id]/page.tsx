import { notFound } from "next/navigation";
import { getWorldContext } from "@/lib/data/world";
import { getLetter } from "@/lib/data/letters";
import { LetterDetailView } from "@/features/letters/LetterDetailView";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorldContext();
  const letter = await getLetter(id, ctx.me.id, ctx.partner?.displayName ?? "Your partner", ctx.me.displayName);
  if (!letter) notFound(); // identical for missing / deleted / private-to-someone-else / malformed
  return <LetterDetailView letter={letter} worldId={ctx.world.id} meId={ctx.me.id} />;
}
