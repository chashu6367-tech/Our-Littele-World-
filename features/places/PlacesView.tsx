"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Compass, Lock, MapPin, Plus } from "lucide-react";
import { useOpenPlaceCreate } from "@/components/CreateContext";
import { fmtDate } from "@/lib/format";
import type { PlaceSummary } from "@/types/places";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
type Filter = "all" | "visited" | "planned";

export function StatusChip({ visited, className = "" }: { visited: boolean; className?: string }) {
  const Icon = visited ? MapPin : Compass;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${visited ? "bg-ink text-paper" : "bg-paper/90 text-rose"} ${className}`}><Icon size={12} aria-hidden />{visited ? "Been there" : "Hoping to go"}</span>;
}

function Card({ p, partner, feature }: { p: PlaceSummary; partner: string; feature: boolean }) {
  return (
    <motion.li variants={rise} layout className={feature ? "sm:col-span-2" : ""}>
      <Link href={`/world/places/${p.id}`} className="group block">
        <div className={`relative overflow-hidden rounded-[1.5rem] shadow-soft ${feature ? "aspect-[4/3] sm:aspect-[2/1]" : "aspect-[4/3]"} ${p.visited ? "bg-cream" : "bg-blush/50 ring-1 ring-inset ring-rose/20"}`}>
          {p.cover ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.cover} alt="" loading={feature ? "eager" : "lazy"} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            : <span className={`grid size-full place-items-center bg-gradient-to-br from-blush to-cream ${p.visited ? "text-rose/60" : "text-gold/70"}`}>{p.visited ? <MapPin size={34} aria-hidden /> : <Compass size={34} aria-hidden />}</span>}
          <StatusChip visited={p.visited} className="absolute right-3 top-3" />
          {p.visibility === "private" && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-xs text-paper"><Lock size={11} aria-hidden />Only you</span>}
        </div>
        <h2 className={`mt-3 font-display leading-snug ${feature ? "text-3xl" : "text-xl"}`}>{p.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          {p.locationText && <span>{p.locationText}</span>}
          {p.visited && p.visitDate && <span>{fmtDate(p.visitDate)}</span>}
          {!p.byMe && <span>from {partner}</span>}
        </p>
      </Link>
    </motion.li>
  );
}

export function PlacesView({ places, partner }: { places: PlaceSummary[]; partner: string }) {
  const openNew = useOpenPlaceCreate();
  const [filter, setFilter] = useState<Filter>("all");
  const visited = places.filter((p) => p.visited).length;
  const shown = places.filter((p) => filter === "all" || (filter === "visited") === p.visited);
  const tabs: [Filter, string, number][] = [["all", "All", places.length], ["visited", "Been there", visited], ["planned", "Hoping to go", places.length - visited]];
  return (
    <motion.div variants={list} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-8 pt-2">
      <motion.header variants={rise} className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Places</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Where we&apos;ve been, and where we&apos;ll <span className="italic text-rose">go</span>.</h1>
        </div>
        {places.length > 0 && <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} aria-label="New place" className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden /><span className="hidden sm:inline">New place</span></motion.button>}
      </motion.header>

      {places.length === 0 ? (
        <motion.section variants={rise} aria-labelledby="empty" className="surface mx-auto max-w-lg px-8 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-blush text-rose"><MapPin size={24} aria-hidden /></span>
          <h2 id="empty" className="mt-6 font-display text-3xl">Some places become <span className="italic text-rose">part of you</span>.</h2>
          <p className="mt-3 text-muted">A first date spot, a favourite street, a city you keep talking about. Add the first one, been there or still to go.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openNew} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden />Add your first place</motion.button>
        </motion.section>
      ) : (
        <>
          <motion.div variants={rise} role="group" aria-label="Filter places" className="flex flex-wrap gap-2">
            {tabs.map(([k, label, n]) => (
              <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                className={`min-h-11 rounded-full px-4 text-sm transition-colors ${filter === k ? "bg-blush text-rose" : "text-muted hover:text-ink"}`}>{label} <span className="opacity-70">· {n}</span></button>
            ))}
          </motion.div>
          {shown.length === 0
            ? <p className="py-10 text-center text-muted">Nothing here yet.</p>
            : <ul className="grid gap-6 sm:grid-cols-2">{shown.map((p, i) => <Card key={p.id} p={p} partner={partner} feature={i === 0 && shown.length > 2} />)}</ul>}
        </>
      )}
    </motion.div>
  );
}
