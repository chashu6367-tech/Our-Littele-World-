import Link from "next/link";
import { Camera } from "lucide-react";
import { StateCard } from "@/components/StateCard";

export default function MemoryNotFound() {
  return (
    <div className="pt-6 md:pt-16">
      <StateCard icon={Camera} title="This memory isn't here" body="It may have been removed, or it isn't something you can open."
        action={<Link href="/world/memories" className="inline-flex min-h-12 items-center rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose">Back to memories</Link>} />
    </div>
  );
}
