import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
export function StateCard({ icon: Icon = Sparkles, title, body, action }: { icon?: LucideIcon; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div role="status" className="surface mx-auto grid max-w-md place-items-center px-8 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-blush text-rose"><Icon size={24} aria-hidden /></span>
      <h2 className="mt-6 font-display text-2xl">{title}</h2>
      <p className="mt-2 text-muted">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
