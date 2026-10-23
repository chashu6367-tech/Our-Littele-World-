"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ExternalLink, Lock, Music, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { useOpenSongCreate } from "@/components/CreateContext";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { SongForm } from "./SongForm";
import type { Song } from "@/types/music";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const act = "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors";
/** Generated artwork tile: no third-party images are ever loaded. Tone is picked from the id so it stays stable. */
const TONES = ["from-blush to-cream text-rose", "from-cream to-blush text-gold", "from-blush to-paper text-rose"];
const tone = (id: string) => TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];

function SongCard({ s, partner, onEdit, onDelete }: { s: Song; partner: string; onEdit: (s: Song) => void; onDelete: (s: Song) => void }) {
  return (
    <motion.li variants={rise} className="surface flex flex-col p-5">
      <div className="flex items-start gap-4">
        <span aria-hidden className={`relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ${tone(s.id)}`}>
          <Music size={26} /><span className="absolute bottom-1 right-1.5 font-display text-xs opacity-60">{s.title.trim().charAt(0).toUpperCase()}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="break-words font-display text-xl leading-snug">{s.title}</h2>
          {s.artist && <p className="mt-0.5 break-words text-muted">{s.artist}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {s.visibility === "private" && <span className="inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-paper"><Lock size={11} aria-hidden />Only you</span>}
            {!s.byMe && <span className="text-muted">from {partner}</span>}
          </div>
        </div>
      </div>
      {s.notes && <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{s.notes}</p>}
      {s.link && (
        // Opens in a new tab with no opener and no referrer; the destination host is shown so it's clear where it goes.
        <a href={s.link.url} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-ink/15 px-5 text-sm transition-colors hover:border-rose hover:text-rose">
          <ExternalLink size={15} aria-hidden />Open on {s.link.host}<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      {s.byMe && (
        <div className="-mx-2 mt-4 flex items-center gap-1 border-t border-ink/10 pt-3">
          <button onClick={() => onEdit(s)} aria-label={`Edit ${s.title}`} className={`${act} text-muted hover:text-ink`}><Pencil size={15} aria-hidden /><span className="sr-only sm:not-sr-only">Edit</span></button>
          <button onClick={() => onDelete(s)} aria-label={`Delete ${s.title}`} className={`${act} text-muted hover:text-rose`}><Trash2 size={15} aria-hidden /><span className="sr-only sm:not-sr-only">Delete</span></button>
        </div>
      )}
    </motion.li>
  );
}

export function MusicView({ songs, worldId, meId, partner }: { songs: Song[]; worldId: string; meId: string; partner: string }) {
  const router = useRouter();
  const openNew = useOpenSongCreate();
  const [editing, setEditing] = useState<Song | null>(null);
  const [deleting, setDeleting] = useState<Song | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setError("");
    // Soft delete only; RLS limits this to the creator and the row is never removed from the client.
    const { data, error: err } = await createClient().from("songs").update({ deleted_at: new Date().toISOString() }).eq("id", deleting.id).select("id");
    setBusy(false);
    if (err || !data?.length) { setError(genericMessage(err, "song-delete")); return; }
    setDeleting(null); router.refresh();
  }

  return (
    <motion.div variants={list} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-10 pt-2">
      <motion.header variants={rise} className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Music</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">The songs that sound like <span className="italic text-rose">us</span>.</h1>
        </div>
        {songs.length > 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} aria-label="New song" className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden /><span className="hidden sm:inline">New song</span></motion.button>}
      </motion.header>

      {songs.length === 0 ? (
        <motion.section variants={rise} aria-labelledby="empty" className="surface mx-auto max-w-lg px-8 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose"><Music size={24} aria-hidden /></span>
          <h2 id="empty" className="mt-6 font-display text-3xl">Every love story has a <span className="italic text-rose">soundtrack</span>.</h2>
          <p className="mt-3 text-muted">The song from the first drive, the one you both know the words to. Save a link to it here, shared or just for you.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden />Add your first song</motion.button>
        </motion.section>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {songs.map((s) => <SongCard key={s.id} s={s} partner={partner} onEdit={(x) => { setError(""); setEditing(x); }} onDelete={(x) => { setError(""); setDeleting(x); }} />)}
        </ul>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit song">
        {editing && <SongForm key={editing.id} worldId={worldId} meId={meId} song={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Sheet>
      <Sheet open={!!deleting} onClose={() => !busy && setDeleting(null)} title="Delete this song?">
        <p className="mt-4 text-muted">“{deleting?.title}” will be removed from your world{deleting?.visibility === "shared" ? ", for both of you" : ""}.</p>
        <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-sm text-rose">{deleting ? error : ""}</p>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={remove} disabled={busy} className="min-h-12 rounded-full bg-rose px-8 text-white transition-colors hover:bg-ink disabled:opacity-60">{busy ? "Deleting…" : "Delete song"}</button>
          <button onClick={() => setDeleting(null)} disabled={busy} className="min-h-12 rounded-full px-5 text-muted hover:text-ink">Keep it</button>
        </div>
      </Sheet>
    </motion.div>
  );
}
