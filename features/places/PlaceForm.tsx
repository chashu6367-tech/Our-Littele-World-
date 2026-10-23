"use client";
import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Compass, ImagePlus, Lock, MapPin, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { COVER_ACCEPT, PLACE_BUCKET, coverPath, validateCover } from "@/lib/places/media";
import type { Visibility } from "@/types/world";
import type { PlaceDetail } from "@/types/places";

const VIS: { value: Visibility; icon: typeof Lock; label: string; hint: string }[] = [
  { value: "shared", icon: Users, label: "Shared", hint: "Both of you can see this." },
  { value: "private", icon: Lock, label: "Only me", hint: "Only you can see this. Your partner won't see it, or know it exists." },
];
const field = "min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60";
const ring = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-rose";

/**
 * Create or edit a place. world_id / created_by come from the server-derived session; the database rejects anything that
 * doesn't match auth.uid() (RLS), and the cover photo goes to the private "place-media" bucket under its own storage policies.
 */
export function PlaceForm({ worldId, meId, place, onDone, onCancel }: {
  worldId: string; meId: string; place?: PlaceDetail; onDone: (id: string) => void; onCancel: () => void;
}) {
  const editing = !!place;
  const [name, setName] = useState(place?.name ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const [locationText, setLocationText] = useState(place?.locationText ?? "");
  const [visited, setVisited] = useState(place?.visited ?? true);
  const [date, setDate] = useState(place?.visitDate ?? "");
  const [visibility, setVisibility] = useState<Visibility>(place?.visibility ?? "shared");
  const [file, setFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const showExisting = !!place?.cover && !removeCover && !file;

  function pick(list: FileList | null) {
    const f = list?.[0]; if (!f) return;
    const problem = validateCover(f);
    if (problem) { setError(problem); return; }
    setError(""); setFile(f); setRemoveCover(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setError("Give this place a name."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const values = { name: name.trim(), description: description.trim() || null, location_text: locationText.trim() || null,
      is_visited: visited, visit_date: visited && date ? date : null, visibility };
    let id = place?.id;
    if (editing) {
      const { data, error: err } = await supabase.from("places").update(values).eq("id", place.id).select("id");
      if (err || !data?.length) { setError(genericMessage(err, "place-update")); setBusy(false); return; }
    } else {
      const { data, error: err } = await supabase.from("places").insert({ world_id: worldId, created_by: meId, ...values }).select("id").single();
      if (err || !data) { setError(genericMessage(err, "place-create")); setBusy(false); return; }
      id = data.id;
    }
    const oldPath = place?.coverPath ?? null;
    if (file && id) {
      const path = coverPath(worldId, id, file.type);
      const up = await supabase.storage.from(PLACE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      const link = up.error ? null : await supabase.from("places").update({ cover_path: path }).eq("id", id);
      if (up.error || link?.error) {
        genericMessage(up.error ?? link?.error, "place-cover");
        if (!up.error) await supabase.storage.from(PLACE_BUCKET).remove([path]);
        setPartial(id); setBusy(false); return;
      }
      if (oldPath) await supabase.storage.from(PLACE_BUCKET).remove([oldPath]);
    } else if (removeCover && oldPath && id) {
      const r = await supabase.from("places").update({ cover_path: null }).eq("id", id);
      if (!r.error) await supabase.storage.from(PLACE_BUCKET).remove([oldPath]);
    }
    onDone(id!);
  }

  if (partial) return (
    <div className="mt-5 space-y-5">
      <h3 className="font-display text-2xl">Your place is saved.</h3>
      <p className="text-muted" role="alert">The cover photo couldn't be uploaded. You can add it again by editing the place.</p>
      <button onClick={() => onDone(partial)} className="min-h-12 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose">Open place</button>
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
      <div className="space-y-1.5"><label htmlFor="p-name" className="text-sm text-muted">Name</label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required disabled={busy} className={field} placeholder="Where is it?" /></div>
      <div className="space-y-1.5"><label htmlFor="p-loc" className="text-sm text-muted">City or location <span className="opacity-70">(optional)</span></label>
        <input id="p-loc" value={locationText} onChange={(e) => setLocationText(e.target.value)} maxLength={200} disabled={busy} className={field} placeholder="Mysuru, India" /></div>

      <fieldset className="space-y-2" disabled={busy}>
        <legend className="mb-1 text-sm text-muted">Have you been?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([[true, MapPin, "We've been"], [false, Compass, "We hope to go"]] as const).map(([v, Icon, label]) => (
            <label key={label} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-sm transition-colors ${ring} ${visited === v ? "border-rose bg-blush/60" : "border-ink/15 bg-white"}`}>
              <input type="radio" name="visited" checked={visited === v} onChange={() => setVisited(v)} className="sr-only" /><Icon size={16} aria-hidden />{label}
            </label>
          ))}
        </div>
      </fieldset>
      {visited && <div className="space-y-1.5"><label htmlFor="p-date" className="text-sm text-muted">When <span className="opacity-70">(optional)</span></label>
        <input id="p-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className={field} /></div>}

      <div className="space-y-1.5"><label htmlFor="p-desc" className="text-sm text-muted">Why it matters <span className="opacity-70">(optional)</span></label>
        <textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} disabled={busy} className={`${field} py-3`} /></div>

      <div>
        <p className="mb-2 text-sm text-muted">Cover photo <span className="opacity-70">(optional, up to 10 MB)</span></p>
        {(showExisting || file) && (
          <div className="relative mb-2 aspect-[16/9] overflow-hidden rounded-2xl bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview ?? place!.cover!} alt="Cover preview" className="size-full object-cover" />
            <button type="button" onClick={() => { setFile(null); setRemoveCover(true); }} aria-label="Remove cover photo" className="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-ink/70 text-paper"><X size={16} aria-hidden /></button>
          </div>
        )}
        <input ref={input} type="file" accept={COVER_ACCEPT} className="sr-only" id="p-cover" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} disabled={busy} />
        <label htmlFor="p-cover" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-gold/60 text-sm text-muted transition-colors hover:border-rose hover:text-rose has-[:focus-visible]:border-rose">
          <ImagePlus size={18} aria-hidden />{showExisting || file ? "Choose a different photo" : "Add a photo"}</label>
      </div>

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
          {busy ? (file ? "Saving and uploading…" : "Saving…") : editing ? "Save changes" : "Keep this place"}</motion.button>
        <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-full px-5 text-muted transition-colors hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}
