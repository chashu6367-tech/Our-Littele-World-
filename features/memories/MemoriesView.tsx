"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Camera, Film, Lock, MapPin, Plus } from "lucide-react";
import { useOpenMemoryCreate } from "@/components/CreateContext";
import { fmtDate } from "@/lib/format";
import type { MemorySummary } from "@/types/memories";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function Card({ m, partner, feature }: { m: MemorySummary; partner: string; feature: boolean }) {
  return (
    <motion.li variants={rise} className={feature ? "sm:col-span-2" : ""}>
      <Link href={`/world/memories/${m.id}`} className="group block">
        <div className={`relative overflow-hidden rounded-[1.5rem] bg-cream shadow-soft ${feature ? "aspect-[4/3] sm:aspect-[2/1]" : "aspect-[4/3]"}`}>
          {m.cover ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.cover} alt="" loading={feature ? "eager" : "lazy"} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            : <span className="grid size-full place-items-center bg-gradient-to-br from-blush to-cream text-rose/60">{m.mediaCount ? <Film size={32} aria-hidden /> : <Camera size={32} aria-hidden />}</span>}
          {m.visibility === "private" && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-xs text-paper"><Lock size={11} aria-hidden />Only you</span>}
        </div>
        <h2 className={`mt-3 font-display leading-snug ${feature ? "text-3xl" : "text-xl"}`}>{m.title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {m.date && <span>{fmtDate(m.date)}</span>}
          {m.location && <span className="flex items-center gap-1"><MapPin size={12} aria-hidden />{m.location}</span>}
          {!m.byMe && <span>from {partner}</span>}
        </p>
      </Link>
    </motion.li>
  );
}

export function MemoriesView({ memories, partner }: { memories: MemorySummary[]; partner: string }) {
  const openNew = useOpenMemoryCreate();
  return (
    <motion.div variants={list} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-10 pt-2">
      <motion.header variants={rise} className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Memories</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Moments worth <span className="italic text-rose">keeping</span>.</h1>
          {memories.length > 0 && <p className="mt-3 text-muted">{memories.length} {memories.length === 1 ? "memory" : "memories"}</p>}
        </div>
        {memories.length > 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} aria-label="New memory" className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden /><span className="hidden sm:inline">New memory</span></motion.button>}
      </motion.header>

      {memories.length === 0 ? (
        <motion.section variants={rise} aria-labelledby="empty" className="surface mx-auto max-w-lg px-8 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose"><Camera size={24} aria-hidden /></span>
          <h2 id="empty" className="mt-6 font-display text-3xl">Some moments are waiting to become <span className="italic text-rose">memories</span>.</h2>
          <p className="mt-3 text-muted">Add a photo, a date, a few words about the day. This is the start of your archive.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden />Add your first memory</motion.button>
        </motion.section>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2">{memories.map((m, i) => <Card key={m.id} m={m} partner={partner} feature={i === 0} />)}</ul>
      )}
    </motion.div>
  );
}
