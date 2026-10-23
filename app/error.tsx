"use client";
import { CloudOff } from "lucide-react";
import { StateCard } from "@/components/StateCard";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <StateCard icon={CloudOff} title="Something slipped" body="That didn't work as expected. Your world is fine — please try again."
        action={<button onClick={reset} className="min-h-11 rounded-full bg-ink px-6 text-paper hover:bg-rose">Try again</button>} />
    </main>
  );
}
