"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import type { Visibility } from "@/types/world";
import type { LetterDetail } from "@/types/letters";

// Private first, and the default for a new letter: sharing is an explicit choice.
const VIS: { value: Visibility; icon: typeof Lock; label: string; hint: string }[] = [
  { value: "private", icon: Lock, label: "Only me", hint: "Only you can read this. Your partner won't see it, or know it exists." },
  { value: "shared", icon: Users, label: "Shared", hint: "Both of you can read this." },
];
const MAX_BODY = 20000;
const field = "min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60";
const ring = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose";

/** Create or edit a letter. world_id / created_by come from the server-derived session; the database rejects anything that doesn't match auth.uid() (RLS). */
export function LetterForm({ worldId, meId, letter, onDone, onCancel }: { worldId: string; meId: string; letter?: LetterDetail; onDone: (id: string) => void; onCancel: () => void }) {
  const editing = !!letter;
  const [title, setTitle] = useState(letter?.title ?? "");
  const [body, setBody] = useState(letter?.body ?? "");
  const [visibility, setVisibility] = useState<Visibility>(letter?.visibility ?? "private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) { setError("Give the letter a title."); return; }
    if (!body.trim()) { setError("Write a few words first."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const values = { title: title.trim(), body, visibility };
    if (editing) {
      const { data, error: err } = await supabase.from("letters").update(values).eq("id", letter.id).select("id");
      if (err || !data?.length) { setError(genericMessage(err, "letter-update")); setBusy(false); return; }
      onDone(letter.id);
    } else {
      const { data, error: err } = await supabase.from("letters").insert({ world_id: worldId, created_by: meId, ...values }).select("id").single();
      if (err || !data) { setError(genericMessage(err, "letter-create")); setBusy(false); return; }
      onDone(data.id);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
      <div className="space-y-1.5"><label htmlFor="l-title" className="text-sm text-muted">Title</label>
        <input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={busy} className={field} placeholder="What is this letter about?" /></div>
      <div className="space-y-1.5"><label htmlFor="l-body" className="text-sm text-muted">Your letter</label>
        <textarea id="l-body" value={body} onChange={(e) => setBody(e.target.value)} rows={10} maxLength={MAX_BODY} required disabled={busy} aria-describedby="l-count"
          className={`${field} resize-y py-3 leading-relaxed`} placeholder="Take your time…" />
        <p id="l-count" className="text-right text-xs text-muted">{body.length.toLocaleString("en-US")} / {MAX_BODY.toLocaleString("en-US")}</p></div>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-1 text-sm text-muted">Who can read this?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VIS.map((v) => (
            <label key={v.value} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${ring} ${visibility === v.value ? "border-rose bg-blush/60" : "border-ink/15 bg-white"}`}>
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
          {busy ? "Saving…" : editing ? "Save changes" : "Keep this letter"}</motion.button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-5 text-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
