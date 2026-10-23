"use client";
import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ImagePlus, Lock, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { ACCEPT, MAX_FILES_PER_MEMORY, MEDIA_BUCKET, mediaInfo, mediaPath, validateFile } from "@/lib/memories/media";
import type { Visibility } from "@/types/world";
import type { MemoryDetail } from "@/types/memories";

const VIS: { value: Visibility; icon: typeof Lock; label: string; hint: string }[] = [
  { value: "shared", icon: Users, label: "Shared", hint: "Both of you can see this." },
  { value: "private", icon: Lock, label: "Only me", hint: "Only you can see this. Your partner won't see it, or know it exists." },
];
const field = "min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60";

/**
 * Create or edit a memory. world_id / created_by / uploaded_by are supplied from the server-derived session context,
 * and the database rejects anything that doesn't match auth.uid() and the caller's world (RLS + storage policies).
 */
export function MemoryForm({ worldId, meId, memory, onDone, onCancel }: {
  worldId: string; meId: string; memory?: MemoryDetail; onDone: (id: string) => void; onCancel: () => void;
}) {
  const editing = !!memory;
  const [title, setTitle] = useState(memory?.title ?? "");
  const [description, setDescription] = useState(memory?.description ?? "");
  const [date, setDate] = useState(memory?.date ?? "");
  const [location, setLocation] = useState(memory?.location ?? "");
  const [visibility, setVisibility] = useState<Visibility>(memory?.visibility ?? "shared");
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState<{ id: string; failed: string[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const kept = (memory?.media ?? []).filter((m) => !removed.includes(m.id));

  function pick(list: FileList | null) {
    if (!list) return;
    const next = [...files]; let problem = "";
    for (const f of Array.from(list)) {
      const bad = validateFile(f);
      if (bad) problem = bad; else if (kept.length + next.length >= MAX_FILES_PER_MEMORY) problem = `You can add up to ${MAX_FILES_PER_MEMORY} photos or videos to one memory.`; else next.push(f);
    }
    setFiles(next); setError(problem);
    if (input.current) input.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !title.trim()) return;
    setBusy(true); setError("");
    const supabase = createClient();
    const values = { title: title.trim(), description: description.trim() || null, memory_date: date || null, location: location.trim() || null, visibility };
    let id = memory?.id ?? "";
    if (editing) {
      const { data, error: err } = await supabase.from("memories").update(values).eq("id", id).select("id");
      if (err || !data?.length) { setError(genericMessage(err, "memory-update")); setBusy(false); return; }
      for (const m of (memory?.media ?? []).filter((x) => removed.includes(x.id))) {
        const { error: rErr } = await supabase.from("memory_media").update({ deleted_at: new Date().toISOString() }).eq("id", m.id);
        if (!rErr) await supabase.storage.from(MEDIA_BUCKET).remove([m.path]);
      }
    } else {
      const { data, error: err } = await supabase.from("memories").insert({ world_id: worldId, created_by: meId, ...values }).select("id").single();
      if (err || !data) { setError(genericMessage(err, "memory-create")); setBusy(false); return; }
      id = data.id;
    }
    const failed: string[] = [];
    for (const f of files) {
      const path = mediaPath(worldId, id, f.type);
      const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) { genericMessage(up.error, "media-upload"); failed.push(f.name); continue; }
      const { error: dbErr } = await supabase.from("memory_media").insert({
        memory_id: id, world_id: worldId, storage_path: path, media_type: mediaInfo(f.type).kind,
        file_name: f.name.slice(0, 200), file_size: f.size, mime_type: f.type, uploaded_by: meId,
      });
      if (dbErr) { genericMessage(dbErr, "media-record"); await supabase.storage.from(MEDIA_BUCKET).remove([path]); failed.push(f.name); }
    }
    if (failed.length) { setPartial({ id, failed }); setBusy(false); return; }
    onDone(id);
  }

  if (partial) return (
    <div className="mt-6 space-y-4" role="alert">
      <p className="font-display text-xl">Your memory is saved.</p>
      <p className="text-muted">{partial.failed.length === 1 ? "One file" : `${partial.failed.length} files`} couldn't be uploaded: {partial.failed.join(", ")}. You can add {partial.failed.length === 1 ? "it" : "them"} again by editing the memory.</p>
      <button onClick={() => onDone(partial.id)} className="min-h-12 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose">Open memory</button>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-5 space-y-5">
      <div className="space-y-1.5"><label htmlFor="m-title" className="text-sm text-muted">Title</label>
        <input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required disabled={busy} className={field} placeholder="What do you want to remember?" /></div>
      <div className="space-y-1.5"><label htmlFor="m-desc" className="text-sm text-muted">The story <span className="opacity-70">(optional)</span></label>
        <textarea id="m-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} disabled={busy} className={`${field} py-3`} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><label htmlFor="m-date" className="text-sm text-muted">Date</label>
          <input id="m-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className={field} /></div>
        <div className="space-y-1.5"><label htmlFor="m-loc" className="text-sm text-muted">Where</label>
          <input id="m-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} disabled={busy} className={field} /></div>
      </div>

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

      <div className="space-y-2">
        <p className="text-sm text-muted">Photos &amp; videos <span className="opacity-70">(up to 50 MB each)</span></p>
        {(kept.length > 0 || files.length > 0) && (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {kept.map((m) => (
              <li key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-cream">
                {m.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center px-1 text-center text-xs text-muted">{m.fileName}</span>}
                <button type="button" onClick={() => setRemoved((r) => [...r, m.id])} aria-label={`Remove ${m.fileName}`} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink/70 text-paper"><X size={14} /></button>
              </li>
            ))}
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-cream">
                <span className="grid size-full place-items-center px-1 text-center text-xs text-muted break-all">{f.name}</span>
                <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink/70 text-paper"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <input ref={input} type="file" accept={ACCEPT} multiple onChange={(e) => pick(e.target.files)} disabled={busy} className="peer sr-only" id="m-files" />
        <label htmlFor="m-files" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/50 text-sm text-muted transition-colors hover:border-rose hover:text-rose peer-focus-visible:border-rose peer-focus-visible:text-rose"><ImagePlus size={18} aria-hidden />Add photos or videos</label>
      </div>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-rose">{error}</p>
      <div className="flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={busy || !title.trim()} className="min-h-12 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose disabled:opacity-60">
          {busy ? (files.length ? "Saving and uploading…" : "Saving…") : editing ? "Save changes" : "Keep this memory"}</motion.button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-5 text-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
