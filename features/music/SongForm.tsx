"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { parseSongUrl } from "@/lib/music/url";
import type { Visibility } from "@/types/world";
import type { Song } from "@/types/music";

const VIS: { value: Visibility; icon: typeof Lock; label: string; hint: string }[] = [
  { value: "shared", icon: Users, label: "Shared", hint: "Both of you can see this." },
  { value: "private", icon: Lock, label: "Only me", hint: "Only you can see this. Your partner won't see it, or know it exists." },
];
const field = "min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60";
const ring = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose";

/** Create or edit a song. world_id / created_by come from the server-derived session; the database rejects anything that doesn't match auth.uid() (RLS). */
export function SongForm({ worldId, meId, song, onDone, onCancel }: { worldId: string; meId: string; song?: Song; onDone: () => void; onCancel: () => void }) {
  const editing = !!song;
  const [title, setTitle] = useState(song?.title ?? "");
  const [artist, setArtist] = useState(song?.artist ?? "");
  const [url, setUrl] = useState(song?.externalUrl ?? "");
  const [notes, setNotes] = useState(song?.notes ?? "");
  const [visibility, setVisibility] = useState<Visibility>(song?.visibility ?? "shared");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [urlError, setUrlError] = useState("");

  // Validated on submit, and live while retyping after an error. NOT on blur: the message shrinks the help text, which moved the
  // Save button up under the user's finger and swallowed the first tap (measured 20-40px shift on phone widths).
  function checkUrl(v: string) {
    if (!v.trim()) { setUrlError(""); return true; }
    const r = parseSongUrl(v);
    setUrlError(r.ok ? "" : r.reason);
    return r.ok;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) { setError("Give the song a title."); return; }
    let externalUrl: string | null = null;
    if (url.trim()) {
      const r = parseSongUrl(url);
      if (!r.ok) { setUrlError(r.reason); setError("Please fix the link first."); return; }
      externalUrl = r.url;
    }
    setBusy(true); setError("");
    const supabase = createClient();
    const values = { title: title.trim(), artist: artist.trim() || null, external_url: externalUrl, description: notes.trim() || null, visibility };
    if (editing) {
      const { data, error: err } = await supabase.from("songs").update(values).eq("id", song.id).select("id");
      if (err || !data?.length) { setError(genericMessage(err, "song-update")); setBusy(false); return; }
    } else {
      const { error: err } = await supabase.from("songs").insert({ world_id: worldId, created_by: meId, ...values });
      if (err) { setError(genericMessage(err, "song-create")); setBusy(false); return; }
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
      <div className="space-y-1.5"><label htmlFor="s-title" className="text-sm text-muted">Song</label>
        <input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={busy} className={field} placeholder="What's the song called?" /></div>
      <div className="space-y-1.5"><label htmlFor="s-artist" className="text-sm text-muted">Artist <span className="opacity-70">(optional)</span></label>
        <input id="s-artist" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} disabled={busy} className={field} /></div>
      <div className="space-y-1.5"><label htmlFor="s-url" className="text-sm text-muted">Link <span className="opacity-70">(optional, https only)</span></label>
        <input id="s-url" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} value={url}
          onChange={(e) => { setUrl(e.target.value); if (urlError) checkUrl(e.target.value); }}
          aria-invalid={!!urlError} aria-describedby="s-url-help" disabled={busy} className={field} placeholder="https://…" />
        <p id="s-url-help" role={urlError ? "alert" : undefined} className={`min-h-5 text-sm ${urlError ? "text-rose" : "text-muted"}`}>
          {urlError || "A link to the song on any music service. We only save the link; nothing is played or downloaded here."}</p></div>
      <div className="space-y-1.5"><label htmlFor="s-notes" className="text-sm text-muted">Album, or why it matters <span className="opacity-70">(optional)</span></label>
        <textarea id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} disabled={busy} className={`${field} py-3`} /></div>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-1 text-sm text-muted">Who can see this?</legend>
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
          {busy ? "Saving…" : editing ? "Save changes" : "Keep this song"}</motion.button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-5 text-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
