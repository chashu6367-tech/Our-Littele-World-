import { WorldShell } from "@/components/WorldShell";
import { getWorldContext } from "@/lib/data/world";

export default async function WorldLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getWorldContext();
  return <WorldShell me={ctx.me.displayName} meId={ctx.me.id} worldId={ctx.world.id} partner={ctx.partner?.displayName ?? null} worldName={ctx.world.name}>{children}</WorldShell>;
}
