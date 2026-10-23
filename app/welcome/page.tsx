import Link from "next/link";
import { redirect } from "next/navigation";
import { CloudOff, HeartCrack } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StateCard } from "@/components/StateCard";
import { SignOutButton } from "@/components/SignOutButton";

/**
 * Recovery state for a signed-in account that is not a member of a world.
 * It never creates a world and never shows anyone else's data. Members are sent straight to their world.
 * (Middleware enforces the same rule; this server check keeps the page safe on its own.)
 */
export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: world, error } = await supabase.from("couple_worlds").select("id").limit(1).maybeSingle(); // RLS: only a world I belong to
  if (world) redirect("/world/home");
  if (error) return ( // the lookup FAILED: that proves nothing about membership, so don't claim the world is missing
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-6">
        <StateCard icon={CloudOff} title="We couldn't reach your world"
          body="This is a connection hiccup, not a problem with your account. Please try again in a moment."
          action={<a href="/world/home" className="inline-flex min-h-12 items-center rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose">Try again</a>} />
        <SignOutButton />
      </div>
    </main>
  );
  return (
    <main className="grid min-h-dvh place-items-center px-6" style={{ background: "radial-gradient(50rem 34rem at 50% 0%, var(--color-blush), transparent 70%)" }}>
      <div className="flex flex-col items-center gap-6">
        <StateCard icon={HeartCrack} title="We can't find your world"
          body="This account isn't linked to Our Little World yet. If you expected to see it, try again in a moment, or sign in with the email you use for your world."
          action={<Link href="/world/home" className="inline-flex min-h-12 items-center rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose">Try again</Link>} />
        <SignOutButton />
      </div>
    </main>
  );
}
