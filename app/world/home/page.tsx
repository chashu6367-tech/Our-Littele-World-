import { getWorldContext } from "@/lib/data/world";
import { getHomePreview } from "@/lib/data/home";
import { HomeView } from "@/features/home/HomeView";

export default async function HomePage() {
  const ctx = await getWorldContext();            // identity + world derived from the session, never from the URL
  const preview = await getHomePreview(ctx.me.id);
  return <HomeView ctx={ctx} preview={preview} />;
}
