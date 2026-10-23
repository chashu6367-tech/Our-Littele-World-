"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Lock, Pencil, Trash2, Users } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { createClient } from "@/lib/supabase/client";
import { genericMessage } from "@/lib/auth/messages";
import { fmtWritten } from "@/lib/format";
import { LetterForm } from "./LetterForm";
import type { LetterDetail } from "@/types/letters";

const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function LetterDetailView({ letter, worldId, meId }: { letter: LetterDetail; worldId: string; meId: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "edit" | "delete">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy) return;
    setBusy(true); setError("");
    // Soft delete only. RLS limits this to the creator; the row is never removed from the client.
    const { data, error: err } = await createClient().from("letters").update({ deleted_at: new Date().toISOString() }).eq("id", letter.id).select("id");
    if (err || !data?.length) { setError(genericMessage(err, "letter-delete")); setBusy(false); return; }
    router.replace("/world/letters"); router.refresh();
  }

  return (
    <motion.article initial="hidden" animate="show" transition={{ staggerChildren: 0.1 }} className="mx-auto max-w-2xl space-y-8 pt-2">
      <motion.div variants={rise}><Link href="/world/letters" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted transition-colors hover:text-ink"><ArrowLeft size={16} aria-hidden />All letters</Link></motion.div>
      <motion.header variants={rise}>
        <p className="text-sm text-muted"><time dateTime={letter.writtenAt} suppressHydrationWarning>{fmtWritten(letter.writtenAt)}</time></p>
        <h1 className="mt-3 break-words font-display text-4xl leading-tight sm:text-5xl">{letter.title}</h1>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          {letter.visibility === "private" ? <span className="flex items-center gap-1.5 text-gold"><Lock size={13} aria-hidden />Only you</span> : <span className="flex items-center gap-1.5"><Users size={13} aria-hidden />Shared</span>}
          <span aria-hidden>·</span>Written by {letter.creatorName}
        </p>
      </motion.header>
      <motion.div variants={rise} className="surface px-6 py-8 sm:px-10 sm:py-10">
        <p className="whitespace-pre-wrap break-words text-lg leading-loose">{letter.body}</p>
      </motion.div>
      {letter.byMe && (
        <motion.div variants={rise} className="flex gap-3 border-t border-ink/10 pt-6">
          <button onClick={() => setSheet("edit")} className="flex min-h-12 items-center gap-2 rounded-full border border-ink/15 px-6 transition-colors hover:border-rose hover:text-rose"><Pencil size={16} aria-hidden />Edit</button>
          <button onClick={() => { setError(""); setSheet("delete"); }} className="flex min-h-12 items-center gap-2 rounded-full px-5 text-muted transition-colors hover:text-rose"><Trash2 size={16} aria-hidden />Delete</button>
        </motion.div>
      )}

      <Sheet open={sheet === "edit"} onClose={() => setSheet(null)} title="Edit letter">
        <LetterForm worldId={worldId} meId={meId} letter={letter} onCancel={() => setSheet(null)} onDone={() => { setSheet(null); router.refresh(); }} />
      </Sheet>
      <Sheet open={sheet === "delete"} onClose={() => !busy && setSheet(null)} title="Delete this letter?">
        <p className="mt-4 text-muted">“{letter.title}” will be removed from your world{letter.visibility === "shared" ? ", for both of you" : ""}.</p>
        <p role="alert" aria-live="polite" className="mt-3 min-h-5 text-sm text-rose">{error}</p>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={remove} disabled={busy} className="min-h-12 rounded-full bg-rose px-8 text-white transition-colors hover:bg-ink disabled:opacity-60">{busy ? "Deleting…" : "Delete letter"}</button>
          <button onClick={() => setSheet(null)} disabled={busy} className="min-h-12 rounded-full px-5 text-muted hover:text-ink">Keep it</button>
        </div>
      </Sheet>
    </motion.article>
  );
}
