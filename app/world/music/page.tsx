import { getWorldContext } from "@/lib/data/world";
import { getSongs } from "@/lib/data/music";
import { MusicView } from "@/features/music/MusicView";

export default async function MusicPage() {
  const ctx = await getWorldContext();
  const songs = await getSongs(ctx.me.id);
  return <MusicView songs={songs} worldId={ctx.world.id} meId={ctx.me.id} partner={ctx.partner?.displayName ?? "Your partner"} />;
}
