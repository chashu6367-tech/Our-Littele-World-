import { getWorldContext } from "@/lib/data/world";
import { getPlaces } from "@/lib/data/places";
import { PlacesView } from "@/features/places/PlacesView";

export default async function PlacesPage() {
  const ctx = await getWorldContext();
  const places = await getPlaces(ctx.me.id);
  return <PlacesView places={places} partner={ctx.partner?.displayName ?? "Your partner"} />;
}
