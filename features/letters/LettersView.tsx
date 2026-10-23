"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Lock, Mail, Plus } from "lucide-react";
import { useOpenLetterCreate } from "@/components/CreateContext";
import { fmtWritten } from "@/lib/format";
import type { LetterSummary } from "@/types/letters";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function LetterCard({ l, partner }: { l: LetterSummary; partner: string }) {
  return (
    <motion.li variants={rise}>
      <Link href={`/world/letters/${l.id}`} className="surface flex min-h-11 flex-col p-6 transition-shadow hover:shadow-soft">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <time dateTime={l.writtenAt} suppressHydrationWarning>{fmtWritten(l.writtenAt)}</time>
          <span aria-hidden>·</span><span>{l.byMe ? "from you" : `from ${partner}`}</span>
          {l.visibility === "private" && <span className="inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-paper"><Lock size={11} aria-hidden />Only you</span>}
        </div>
        <h2 className="mt-3 break-words font-display text-2xl leading-snug">{l.title}</h2>
        <p className="mt-2 line-clamp-3 break-words text-muted">{l.excerpt}</p>
      </Link>
    </motion.li>
  );
}

export function LettersView({ letters, partner }: { letters: LetterSummary[]; partner: string }) {
  const openNew = useOpenLetterCreate();
  return (
    <motion.div variants={list} initial="hidden" animate="show" className="mx-auto max-w-3xl space-y-10 pt-2">
      <motion.header variants={rise} className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Letters</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Words written <span className="italic text-rose">slowly</span>.</h1>
        </div>
        {letters.length > 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} aria-label="New letter" className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden /><span className="hidden sm:inline">New letter</span></motion.button>}
      </motion.header>

      {letters.length === 0 ? (
        <motion.section variants={rise} aria-labelledby="empty" className="surface mx-auto max-w-lg px-8 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose"><Mail size={24} aria-hidden /></span>
          <h2 id="empty" className="mt-6 font-display text-3xl">The things that are easier to <span className="italic text-rose">write</span>.</h2>
          <p className="mt-3 text-muted">Write something for each other, or just for yourself. Letters start private; you choose when to share.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden />Write your first letter</motion.button>
        </motion.section>
      ) : (
        <ul className="space-y-4">{letters.map((l) => <LetterCard key={l.id} l={l} partner={partner} />)}</ul>
      )}
    </motion.div>
  );
}
