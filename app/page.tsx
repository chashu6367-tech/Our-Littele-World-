"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

const grain = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")";
const drift = (x: number, y: number, d: number) => ({ opacity: 1, x: [0, x, 0], y: [0, y, 0], transition: { opacity: { duration: 2.5 }, x: { duration: d, repeat: Infinity, ease: "easeInOut" as const }, y: { duration: d, repeat: Infinity, ease: "easeInOut" as const } } });
const word = { hidden: { y: "105%" }, show: { y: 0, transition: { duration: 1, ease: [0.22, 1, 0.36, 1] as const } } };

export default function Welcome() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 text-center">
      <motion.div aria-hidden initial={{ opacity: 0 }} animate={drift(40, -24, 22)} className="absolute -left-24 top-[12%] size-[26rem] rounded-full bg-blush blur-3xl" />
      <motion.div aria-hidden initial={{ opacity: 0 }} animate={drift(-36, 28, 26)} className="absolute -right-20 bottom-[8%] size-[24rem] rounded-full bg-gold/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.07] mix-blend-multiply" style={{ backgroundImage: grain }} />
      <div className="relative max-w-2xl">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1.2 }} className="eyebrow">Yashu &nbsp;·&nbsp; Chandana</motion.p>
        <motion.h1 initial="hidden" animate="show" transition={{ delayChildren: 0.9, staggerChildren: 0.14 }} aria-label="Our Little World"
          className="mt-6 font-display text-6xl leading-[1.05] sm:text-8xl">
          {["Our", "Little", "World"].map((w, i) => (
            <span key={w} aria-hidden className="mr-[.25em] inline-block overflow-hidden pb-3 align-bottom last:mr-0">
              <motion.span variants={word} className={`inline-block ${i === 2 ? "italic text-rose" : ""}`}>{w}</motion.span>
            </span>
          ))}
          <motion.span variants={word} aria-hidden className="ml-2 inline-block text-4xl sm:text-5xl">❤️</motion.span>
        </motion.h1>
        <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.9, duration: 1.2 }} className="mx-auto mt-8 h-px w-24 origin-center bg-gold/60" />
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.1 }} className="mx-auto mt-6 max-w-sm text-lg text-muted">Two people. One little world.</motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }} className="mt-10">
          <motion.div className="inline-block" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/world/home" className="group inline-flex min-h-13 items-center gap-3 rounded-full bg-ink px-9 py-3.5 text-paper shadow-soft transition-colors duration-300 hover:bg-rose">
              Enter our world <ArrowRight size={18} aria-hidden className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
