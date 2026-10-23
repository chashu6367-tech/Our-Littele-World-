"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import type { MemoryMediaItem } from "@/types/memories";

function Lightbox({ media, start, onClose }: { media: MemoryMediaItem[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const go = (d: number) => setI((n) => (n + d + media.length) % media.length);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const m = media[i];
  return (
    <motion.div role="dialog" aria-modal="true" aria-label="Photo viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] grid place-items-center bg-ink/95 p-4" onClick={onClose}>
      <button autoFocus onClick={onClose} aria-label="Close" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-paper/10 text-paper"><X size={20} /></button>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] max-w-5xl">
        <AnimatePresence mode="wait">
          <motion.div key={m.id} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {m.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.fileName} className="max-h-[85dvh] rounded-2xl object-contain" />
              : <video src={m.url} controls playsInline autoPlay className="max-h-[85dvh] rounded-2xl" />}
          </motion.div>
        </AnimatePresence>
      </div>
      {media.length > 1 && (<>
        <button onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous" className="absolute left-3 grid size-12 place-items-center rounded-full bg-paper/10 text-paper"><ChevronLeft /></button>
        <button onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next" className="absolute right-3 grid size-12 place-items-center rounded-full bg-paper/10 text-paper"><ChevronRight /></button>
        <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-sm text-paper/70" aria-live="polite">{i + 1} / {media.length}</p>
      </>)}
    </motion.div>
  );
}

export function MediaGallery({ media, title }: { media: MemoryMediaItem[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!media.length) return null;
  const tile = (m: MemoryMediaItem, i: number, cls: string) => (
    <button key={m.id} onClick={() => setOpen(i)} aria-label={`Open ${m.kind} ${i + 1} of ${media.length}`} className={`group relative overflow-hidden bg-cream ${cls}`}>
      {m.kind === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={i === 0 ? title : ""} loading={i === 0 ? "eager" : "lazy"} className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        : <span className="grid size-full place-items-center bg-ink/80 text-paper"><Play size={28} aria-hidden /></span>}
    </button>
  );
  return (
    <>
      <div className="space-y-2">
        {tile(media[0], 0, "aspect-[4/3] w-full rounded-[2rem] shadow-soft sm:aspect-[16/10]")}
        {media.length > 1 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{media.slice(1).map((m, i) => tile(m, i + 1, "aspect-square rounded-2xl"))}</div>}
      </div>
      <AnimatePresence>{open !== null && <Lightbox media={media} start={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  );
}
