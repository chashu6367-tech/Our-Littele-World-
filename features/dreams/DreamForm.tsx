"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { CHOOSABLE, STATUS_META, completedAtFor } from "@/lib/dreams/status";
import type { Visibility } from "@/types/world";
import type { Dream, DreamStatus } from "@/types/dreams";

const VIS: { value: Visibility; icon: typeof Lock; label: string; hint: string }[] = [
  { value: "shared", icon: Users, label: "Shared", hint: "Both of you can see this." },
  { value: "private", icon: Lock, label: "Only me", hint: "Only you can see this. Your partner won't see it, or know it exists." },
];
const field = "min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60";
const radioCard = (on: boolean) => `flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose ${on ? "border-rose bg-blush/60" : "border-ink/15 bg-white"}`;

/** Create or edit a dream. world_id / created_by come from the server-derived session; the database rejects anything that doesn't match auth.uid() (RLS). */
export function DreamForm({ worldId, meId, dream, onDone, onCancel }: {
  worldId: string; meId: string; dream?: Dream; onDone: () => void; onCancel: () => void;
}) {
  const editing = !!dream;
  const [title, setTitle] = useState(dream?.title ?? "");
  const [description, setDescription] = useState(dream?.description ?? "");
  const [status, setStatus] = useState<DreamStatus>(dream && dream.status !== "dreaming" ? dream.status : "planned");
  const [target, setTarget] = useState(dream?.targetDate ?? "");
  const [visibility, setVisibility] = useState<Visibility>(dream?.visibility ?? "shared");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) { setError("Give your dream a title."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const values = { title: title.trim(), description: description.trim() || null, target_date: target || null, visibility,
      status, completed_at: completedAtFor(status, dream?.completedAt ?? null) };
    if (editing) {
      const { data, error: err } = await supabase.from("dreams").update(values).eq("id", dream.id).select("id");
      if (err || !data?.length) { setError(genericMessage(err, "dream-update")); setBusy(false); return; }
    } else {
      const { error: err } = await supabase.from("dreams").insert({ world_id: worldId, created_by: meId, ...values });
      if (err) { setError(genericMessage(err, "dream-create")); setBusy(false); return; }
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
      <div className="space-y-1.5"><label htmlFor="d-title" className="text-sm text-muted">Title</label>
        <input id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={busy} className={field} placeholder="What do you hope for?" /></div>
      <div className="space-y-1.5"><label htmlFor="d-desc" className="text-sm text-muted">Tell the dream <span className="opacity-70">(optional)</span></label>
        <textarea id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} disabled={busy} className={`${field} py-3`} /></div>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-1 text-sm text-muted">Where is it now?</legend>
        <div className="grid grid-cols-3 gap-2">
          {CHOOSABLE.map((s) => (
            <label key={s} className={radioCard(status === s)}>
              <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
              {STATUS_META[s].label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5"><label htmlFor="d-target" className="text-sm text-muted">Hoping for <span className="opacity-70">(optional date)</span></label>
        <input id="d-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} className={field} /></div>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-1 text-sm text-muted">Who can see this?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VIS.map((v) => (
            <label key={v.value} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose ${visibility === v.value ? "border-rose bg-blush/60" : "border-ink/15 bg-white"}`}>
              <input type="radio" name="visibility" value={v.value} checked={visibility === v.value} onChange={() => setVisibility(v.value)} className="sr-only" />
              <v.icon size={18} aria-hidden className="mt-0.5 shrink-0 text-rose" />
              <span><span className="block font-medium">{v.label}</span><span className="block text-sm text-muted">{v.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-rose">{error}</p>
      <div className="flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={busy} className="min-h-12 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Save changes" : "Keep this dream"}</motion.button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-5 text-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
