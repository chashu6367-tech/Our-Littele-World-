"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Lock, MapPin, Pencil, Trash2, Users } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { fmtDate } from "@/lib/format";
import { PlaceForm } from "./PlaceForm";
import { StatusChip } from "./PlacesView";
import type { PlaceDetail } from "@/types/places";

const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function PlaceDetailView({ place, worldId, meId }: { place: PlaceDetail; worldId: string; meId: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "edit" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    setBusy(true); setError("");
    // Soft delete only. RLS limits this to the creator; the row is never removed from the client.
    const { data, error: err } = await createClient().from("places").update({ deleted_at: new Date().toISOString() }).eq("id", place.id).select("id");
    if (err || !data?.length) { setError(genericMessage(err, "place-delete")); setBusy(false); return; }
    router.replace("/world/places"); router.refresh();
  }

  return (
    <motion.article initial="hidden" animate="show" transition={{ staggerChildren: 0.1 }} className="mx-auto max-w-3xl space-y-8 pt-2">
      <motion.div variants={rise}><Link href="/world/places" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted transition-colors hover:text-ink"><ArrowLeft size={16} aria-hidden />All places</Link></motion.div>
      {place.cover && <motion.div variants={rise} className="overflow-hidden rounded-[2rem] bg-cream shadow-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={place.cover} alt={place.name} className="aspect-[4/3] size-full object-cover sm:aspect-[16/10]" /></motion.div>}
      <motion.header variants={rise}>
        <div className="flex flex-wrap items-center gap-3"><StatusChip visited={place.visited} className={place.visited ? "" : "!bg-blush"} />
          {place.visited && place.visitDate && <span className="text-sm text-muted">{fmtDate(place.visitDate)}</span>}</div>
        <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{place.name}</h1>
        {place.locationText && <p className="mt-2 flex items-center gap-1.5 text-muted"><MapPin size={14} aria-hidden />{place.locationText}</p>}
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          {place.visibility === "private" ? <span className="flex items-center gap-1.5 text-gold"><Lock size={13} aria-hidden />Only you</span> : <span className="flex items-center gap-1.5"><Users size={13} aria-hidden />Shared</span>}
          <span aria-hidden>·</span>Kept by {place.creatorName}
        </p>
      </motion.header>
      {place.description && <motion.p variants={rise} className="max-w-prose whitespace-pre-wrap text-lg leading-relaxed">{place.description}</motion.p>}
      {place.byMe && (
        <motion.div variants={rise} className="flex gap-3 border-t border-ink/10 pt-6">
          <button onClick={() => setSheet("edit")} className="flex min-h-12 items-center gap-2 rounded-full border border-ink/15 px-6 transition-colors hover:border-rose hover:text-rose"><Pencil size={16} aria-hidden />Edit</button>
          <button onClick={() => { setError(""); setSheet("delete"); }} className="flex min-h-12 items-center gap-2 rounded-full px-5 text-muted transition-colors hover:text-rose"><Trash2 size={16} aria-hidden />Delete</button>
        </motion.div>
      )}

      <Sheet open={sheet === "edit"} onClose={() => setSheet(null)} title="Edit place">
        <PlaceForm worldId={worldId} meId={meId} place={place} onCancel={() => setSheet(null)} onDone={() => { setSheet(null); router.refresh(); }} />
      </Sheet>
      <Sheet open={sheet === "delete"} onClose={() => !busy && setSheet(null)} title="Delete this place?">
        <p className="mt-4 text-muted">“{place.name}” will be removed from your world{place.visibility === "shared" ? ", for both of you" : ""}.</p>
        <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-sm text-rose">{error}</p>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={remove} disabled={busy} className="min-h-12 rounded-full bg-rose px-8 text-white transition-colors hover:bg-ink disabled:opacity-60">{busy ? "Deleting…" : "Delete place"}</button>
          <button onClick={() => setSheet(null)} disabled={busy} className="min-h-12 rounded-full px-5 text-muted hover:text-ink">Keep it</button>
        </div>
      </Sheet>
    </motion.article>
  );
}
