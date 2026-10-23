"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Lock, Plus } from "lucide-react";
import { useOpenCreate } from "@/components/CreateContext";
import { NAV } from "@/lib/nav";
import type { HomePreview, PreviewItem, WorldContext } from "@/types/world";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const rise = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };
const EXPLORE = ["letters", "surprises", "dreams", "places", "music", "journal", "settings"].map((s) => NAV.find((n) => n.slug === s)!);
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" });

function Section({ id, title, items, empty, partner, href }: { id: string; title: string; items: PreviewItem[]; empty: string; partner: string; href?: (id: string) => string }) {
  return (
    <motion.section variants={rise} aria-labelledby={id}>
      <h2 id={id} className="font-display text-2xl">{title}</h2>
      {items.length ? (
        <ul className="mt-3 divide-y divide-ink/10">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                {href ? <Link href={href(i.id)} className="block truncate hover:text-rose">{i.title}</Link> : <p className="truncate">{i.title}</p>}
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  {i.byMe ? "You" : partner}{i.date && <> · {fmt(i.date)}</>}
                  {i.visibility === "private" && <span className="flex items-center gap-1 text-gold"><Lock size={11} aria-hidden />Only you</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-sm text-muted">{empty}</p>}
    </motion.section>
  );
}

export function HomeView({ ctx, preview }: { ctx: WorldContext; preview: HomePreview }) {
  const openCreate = useOpenCreate();
  const viewer = ctx.me.displayName;
  const partner = ctx.partner?.displayName ?? "your partner";
  // Shown only when the couple has actually set a date. No duration is ever calculated.
  const since = ctx.world.relationshipStartDate ? fmt(ctx.world.relationshipStartDate) : null;
  return (
    <motion.div variants={list} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-14 pt-2">
      <motion.header variants={rise}>
        <p className="eyebrow">{ctx.world.name}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">Welcome back, <span className="italic text-rose">{viewer}</span>.</h1>
        <p className="mt-3 text-lg text-muted">Your little world is waiting.</p>
      </motion.header>

      <motion.article variants={rise} className="relative isolate min-h-60 overflow-hidden rounded-[2rem] p-8 text-paper shadow-soft sm:min-h-72 sm:p-10"
        style={{ background: "linear-gradient(160deg,#3b2a31,#6b3a47 60%,#8f4a58)" }}>
        <div aria-hidden className="absolute -right-16 -top-20 -z-10 size-80 rounded-full bg-gold/40 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 left-1/3 -z-10 size-72 rounded-full bg-rose/50 blur-3xl" />
        <div aria-hidden className="absolute right-8 top-8 -z-10 h-40 w-28 rounded-t-full border border-paper/20 sm:h-56 sm:w-40" />
        <div className="flex min-h-44 flex-col justify-end sm:min-h-56">
          <h2 className="font-display text-3xl leading-snug sm:text-4xl">{viewer}{ctx.partner && <> <span className="italic">&</span> {ctx.partner.displayName}</>}</h2>
          <p className="mt-3 text-paper/80">{since ? `Together since ${since}` : "Your relationship date isn't set yet."}</p>
        </div>
      </motion.article>

      {preview.isEmpty ? (
        <motion.section variants={rise} aria-labelledby="begin" className="surface mx-auto max-w-lg px-8 py-12 text-center">
          <h2 id="begin" className="font-display text-3xl">This is where your little world <span className="italic text-rose">begins</span>.</h2>
          <p className="mt-3 text-muted">Your first memory, letter, dream or moment can live here. Start with whichever feels right.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate}
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-paper transition-colors hover:bg-rose">
            <Plus size={18} aria-hidden />Add to our world
          </motion.button>
        </motion.section>
      ) : (
        <>
          <Section id="mem" title="Latest memories" items={preview.memories} empty="No memories yet." partner={partner} href={(id) => `/world/memories/${id}`} />
          <Section id="up" title="Coming up" items={preview.milestones} empty="Nothing marked ahead yet." partner={partner} />
          <Section id="dream" title="Still to come" items={preview.dreams} empty="No dreams added yet." partner={partner} />
        </>
      )}

      <motion.nav variants={rise} aria-label="Explore" className="md:hidden">
        <h2 className="eyebrow">Explore</h2>
        <ul className="mt-3 flex flex-wrap gap-2.5">
          {EXPLORE.map((n) => (
            <li key={n.slug}><Link href={`/world/${n.slug}`} className="flex min-h-11 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm"><n.icon size={15} aria-hidden className="text-gold" />{n.label}</Link></li>
          ))}
        </ul>
      </motion.nav>
    </motion.div>
  );
}
