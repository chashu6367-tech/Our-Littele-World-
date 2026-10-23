import { notFound } from "next/navigation";
import { getWorldContext } from "@/lib/data/world";
import { getPlace } from "@/lib/data/places";
import { PlaceDetailView } from "@/features/places/PlaceDetailView";

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getWorldContext();
  const place = await getPlace(id, ctx.me.id, ctx.partner?.displayName ?? "Your partner", "you");
  if (!place) notFound(); // identical for missing / deleted / private-to-someone-else / malformed
  return <PlaceDetailView place={place} worldId={ctx.world.id} meId={ctx.me.id} />;
}
