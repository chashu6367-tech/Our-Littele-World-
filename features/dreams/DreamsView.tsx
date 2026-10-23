"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Lock, Pencil, Play, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { useOpenDreamCreate } from "@/components/CreateContext";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { fmtDate } from "@/lib/format";
import { GROUPS, STATUS_META, completedAtFor } from "@/lib/dreams/status";
import { DreamForm } from "./DreamForm";
import type { Dream, DreamStatus } from "@/types/dreams";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const act = "flex min-h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors disabled:opacity-60";

function DreamCard({ d, partner, busy, onStatus, onEdit, onDelete }: {
  d: Dream; partner: string; busy: boolean; onStatus: (d: Dream, s: DreamStatus) => void; onEdit: (d: Dream) => void; onDelete: (d: Dream) => void;
}) {
  const meta = STATUS_META[d.status];
  const done = d.status === "achieved";
  return (
    <motion.li variants={rise} className="surface flex flex-col p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${meta.chip}`}><meta.icon size={12} aria-hidden />{meta.label}</span>
        {d.visibility === "private" && <span className="inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-paper"><Lock size={11} aria-hidden />Only you</span>}
        {!d.byMe && <span className="text-muted">from {partner}</span>}
      </div>
      <h3 className={`mt-4 font-display text-2xl leading-snug ${done ? "text-muted" : ""}`}>{d.title}</h3>
      {d.description && <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-muted">{d.description}</p>}
      <p className="mt-3 text-sm text-muted">
        {done && d.completedAt ? <>Completed {fmtDate(d.completedAt)}</> : d.targetDate ? <>Hoping for {fmtDate(d.targetDate)}</> : null}
      </p>
      {d.byMe && (
        <div className="-mx-2 mt-4 flex flex-wrap items-center gap-1 border-t border-ink/10 pt-3">
          {d.status !== "in_progress" && !done && <button disabled={busy} onClick={() => onStatus(d, "in_progress")} className={`${act} text-rose hover:bg-blush`}><Play size={15} aria-hidden />Start</button>}
          {!done && <button disabled={busy} onClick={() => onStatus(d, "achieved")} className={`${act} text-rose hover:bg-blush`}><Check size={15} aria-hidden />Mark completed</button>}
          {done && <button disabled={busy} onClick={() => onStatus(d, "in_progress")} className={`${act} text-muted hover:text-ink`}><Undo2 size={15} aria-hidden />Reopen</button>}
          <button onClick={() => onEdit(d)} aria-label={`Edit ${d.title}`} className={`${act} ml-auto text-muted hover:text-ink`}><Pencil size={15} aria-hidden /><span className="sr-only sm:not-sr-only">Edit</span></button>
          <button onClick={() => onDelete(d)} aria-label={`Delete ${d.title}`} className={`${act} text-muted hover:text-rose`}><Trash2 size={15} aria-hidden /><span className="sr-only sm:not-sr-only">Delete</span></button>
        </div>
      )}
    </motion.li>
  );
}

export function DreamsView({ dreams, worldId, meId, partner }: { dreams: Dream[]; worldId: string; meId: string; partner: string }) {
  const router = useRouter();
  const openNew = useOpenDreamCreate();
  const [editing, setEditing] = useState<Dream | null>(null);
  const [deleting, setDeleting] = useState<Dream | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function setStatus(d: Dream, status: DreamStatus) {
    if (busyId) return;
    setBusyId(d.id); setError("");
    // RLS limits updates to the creator; completed_at must match status (database CHECK).
    const { data, error: err } = await createClient().from("dreams")
      .update({ status, completed_at: completedAtFor(status, d.completedAt) }).eq("id", d.id).select("id");
    setBusyId(null);
    if (err || !data?.length) { setError(genericMessage(err, "dream-status")); return; }
    router.refresh();
  }

  async function remove() {
    if (!deleting || busyId) return;
    setBusyId(deleting.id); setError("");
    // Soft delete only; the row is never removed from the client.
    const { data, error: err } = await createClient().from("dreams").update({ deleted_at: new Date().toISOString() }).eq("id", deleting.id).select("id");
    setBusyId(null);
    if (err || !data?.length) { setError(genericMessage(err, "dream-delete")); return; }
    setDeleting(null); router.refresh();
  }

  return (
    <motion.div variants={list} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-10 pt-2">
      <motion.header variants={rise} className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dreams</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Everything we hope to <span className="italic text-rose">become</span>.</h1>
        </div>
        {dreams.length > 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} aria-label="New dream" className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden /><span className="hidden sm:inline">New dream</span></motion.button>}
      </motion.header>

      <p role="alert" aria-live="polite" className={error ? "flex items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 text-sm text-rose" : "sr-only"}>
        {error && <><span>{error}</span><button onClick={() => setError("")} className="min-h-11 shrink-0 px-2 underline">Dismiss</button></>}
      </p>

      {dreams.length === 0 ? (
        <motion.section variants={rise} aria-labelledby="empty" className="surface mx-auto max-w-lg px-8 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose"><Sparkles size={24} aria-hidden /></span>
          <h2 id="empty" className="mt-6 font-display text-3xl">Every shared life starts with something you <span className="italic text-rose">hope for</span>.</h2>
          <p className="mt-3 text-muted">A trip, a home, a small ritual, a big leap. Write down the first one, and keep it shared or just for you.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden />Add your first dream</motion.button>
        </motion.section>
      ) : GROUPS.map((g) => {
        const items = dreams.filter((d) => g.statuses.includes(d.status));
        if (!items.length) return null;
        return (
          <motion.section key={g.title} variants={rise} aria-labelledby={`g-${g.title}`}>
            <h2 id={`g-${g.title}`} className="font-display text-2xl">{g.title} <span className="text-base text-muted">· {items.length}</span></h2>
            <ul className="mt-4 grid gap-5 sm:grid-cols-2">
              {items.map((d) => <DreamCard key={d.id} d={d} partner={partner} busy={busyId === d.id} onStatus={setStatus} onEdit={(x) => { setError(""); setEditing(x); }} onDelete={(x) => { setError(""); setDeleting(x); }} />)}
            </ul>
          </motion.section>
        );
      })}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit dream">
        {editing && <DreamForm key={editing.id} worldId={worldId} meId={meId} dream={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
      </Sheet>
      <Sheet open={!!deleting} onClose={() => !busyId && setDeleting(null)} title="Delete this dream?">
        <p className="mt-4 text-muted">“{deleting?.title}” will be removed from your world{deleting?.visibility === "shared" ? ", for both of you" : ""}.</p>
        <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-sm text-rose">{deleting ? error : ""}</p>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={remove} disabled={!!busyId} className="min-h-12 rounded-full bg-rose px-8 text-white transition-colors hover:bg-ink disabled:opacity-60">{busyId ? "Deleting…" : "Delete dream"}</button>
          <button onClick={() => setDeleting(null)} disabled={!!busyId} className="min-h-12 rounded-full px-5 text-muted hover:text-ink">Keep it</button>
        </div>
      </Sheet>
    </motion.div>
  );
}
