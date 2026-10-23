import Link from "next/link";
import { Compass } from "lucide-react";
import { StateCard } from "@/components/StateCard";
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <StateCard icon={Compass} title="This corner doesn't exist" body="Let's head back home."
        action={<Link href="/world/home" className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 text-paper hover:bg-rose">Go home</Link>} />
    </main>
  );
}
