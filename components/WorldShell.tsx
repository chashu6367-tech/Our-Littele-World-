"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { CREATE_OPTIONS, NAV, type NavItem } from "@/lib/nav";
import { MemoryForm } from "@/features/memories/MemoryForm";
import { DreamForm } from "@/features/dreams/DreamForm";
import { PlaceForm } from "@/features/places/PlaceForm";
import { SongForm } from "@/features/music/SongForm";
import { LetterForm } from "@/features/letters/LetterForm";
import { CreateContext, DreamCreateContext, LetterCreateContext, MemoryCreateContext, PlaceCreateContext, SongCreateContext } from "./CreateContext";
import { Sheet } from "./Sheet";
import { SignOutButton } from "./SignOutButton";

const spring = { type: "spring", stiffness: 380, damping: 34 } as const;
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const rise = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const bySlug = (s: string) => NAV.find((n) => n.slug === s)!;

function RailLink({ n, active }: { n: NavItem; active: boolean }) {
  return (
    <Link href={`/world/${n.slug}`} aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-full px-4 text-sm transition-colors ${active ? "text-rose" : "text-muted hover:text-ink"}`}>
      {active && <motion.span layoutId="rail-active" transition={spring} className="absolute inset-0 rounded-full bg-blush" />}
      <n.icon size={18} aria-hidden className="relative transition-transform duration-300 group-hover:translate-x-0.5" />
      <span className="relative">{n.label}</span>
      {active && <span aria-hidden className="relative ml-auto size-1.5 rounded-full bg-rose" />}
    </Link>
  );
}

function BarLink({ n, active, label }: { n: NavItem; active: boolean; label: string }) {
  return (
    <Link href={`/world/${n.slug}`} aria-current={active ? "page" : undefined}
      className={`relative flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[0.65rem] transition-colors ${active ? "text-rose" : "text-muted"}`}>
      <n.icon size={20} aria-hidden />{label}
      {active && <motion.span layoutId="bar-dot" transition={spring} aria-hidden className="absolute bottom-0 size-1 rounded-full bg-rose" />}
    </Link>
  );
}

export function WorldShell({ me, meId, worldId, partner, worldName, children }: { me: string; meId: string; worldId: string; partner: string | null; worldName: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState<null | "create" | "memory" | "dream" | "place" | "song" | "letter" | "account">(null);
  const [note, setNote] = useState("");
  const isActive = (slug: string) => path === `/world/${slug}` || path.startsWith(`/world/${slug}/`);
  const openCreate = () => setSheet("create");
  const openMemory = () => setSheet("memory");
  const openDream = () => setSheet("dream");
  const openPlace = () => setSheet("place");
  const openSong = () => setSheet("song");
  const openLetter = () => setSheet("letter");
  const closeCreate = () => { setSheet(null); setNote(""); };
  const initial = me.trim().charAt(0).toUpperCase() || "•";   // no avatar images yet: initials only
  return (
    <CreateContext.Provider value={openCreate}>
    <MemoryCreateContext.Provider value={openMemory}>
    <DreamCreateContext.Provider value={openDream}>
    <PlaceCreateContext.Provider value={openPlace}>
    <SongCreateContext.Provider value={openSong}>
    <LetterCreateContext.Provider value={openLetter}>
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col px-5 py-9 md:flex">
          <Link href="/world/home" className="px-4 font-display text-xl leading-tight">Our Little World <span aria-hidden>❤️</span></Link>
          <nav aria-label="Main" className="mt-10 flex flex-col gap-1">{NAV.map((n) => <RailLink key={n.slug} n={n} active={isActive(n.slug)} />)}</nav>
          <p className="mt-auto px-4 pb-3 text-sm text-muted">{me}{partner && <> <span className="text-rose">&</span> {partner}</>}</p>
          <SignOutButton />
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCreate} className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink text-paper transition-colors hover:bg-rose"><Plus size={18} aria-hidden />Add to our world</motion.button>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))] md:px-10 md:pb-16 md:pt-12">
          <header className="mb-8 flex items-center justify-between md:hidden">
            <span className="font-display text-lg">Our Little World <span aria-hidden>❤️</span></span>
            <button onClick={() => setSheet("account")} aria-label="Account" className="grid size-11 place-items-center rounded-full bg-blush font-medium text-rose">{initial}</button>
          </header>
          {children}
        </main>

        <nav aria-label="Main" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center justify-between rounded-full bg-white/95 px-3 py-1.5 shadow-soft md:hidden">
          <BarLink n={bySlug("home")} active={isActive("home")} label="Home" />
          <BarLink n={bySlug("story")} active={isActive("story")} label="Story" />
          <motion.button whileTap={{ scale: 0.92 }} onClick={openCreate} aria-label="Add to our world" className="-mt-6 grid size-12 place-items-center rounded-full bg-rose text-white shadow-soft"><Plus size={22} aria-hidden /></motion.button>
          <BarLink n={bySlug("memories")} active={isActive("memories")} label="Memories" />
          <BarLink n={bySlug("us")} active={isActive("us")} label="Us" />
        </nav>

        <Sheet open={sheet === "create"} onClose={closeCreate} title="What do you want to add to our world?">
          <motion.ul variants={stagger} initial="hidden" animate="show" className="mt-5 grid gap-1 sm:grid-cols-2">
            {CREATE_OPTIONS.map((o) => (
              <motion.li key={o.label} variants={rise}>
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => (o.label === "Memory" ? openMemory() : o.label === "Dream" ? openDream() : o.label === "Place" ? openPlace() : o.label === "Song" ? openSong() : o.label === "Letter" ? openLetter() : setNote(`Adding a ${o.label.toLowerCase()} isn't ready yet — it's coming soon.`))}
                  className="flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-blush text-rose"><o.icon size={20} aria-hidden /></span>
                  <span><span className="block font-medium">{o.label}</span><span className="block text-sm text-muted">{o.blurb}</span></span>
                </motion.button>
              </motion.li>
            ))}
          </motion.ul>
          <p role="status" className="mt-4 min-h-6 text-center text-sm text-muted">{note}</p>
        </Sheet>
        <Sheet open={sheet === "memory"} onClose={() => setSheet(null)} title="New memory">
          <MemoryForm worldId={worldId} meId={meId} onCancel={() => setSheet(null)} onDone={(id) => { setSheet(null); router.push(`/world/memories/${id}`); }} />
        </Sheet>
        <Sheet open={sheet === "dream"} onClose={() => setSheet(null)} title="New dream">
          <DreamForm worldId={worldId} meId={meId} onCancel={() => setSheet(null)} onDone={() => { setSheet(null); router.push("/world/dreams"); router.refresh(); }} />
        </Sheet>
        <Sheet open={sheet === "place"} onClose={() => setSheet(null)} title="New place">
          <PlaceForm worldId={worldId} meId={meId} onCancel={() => setSheet(null)} onDone={(id) => { setSheet(null); router.push(`/world/places/${id}`); router.refresh(); }} />
        </Sheet>
        <Sheet open={sheet === "song"} onClose={() => setSheet(null)} title="New song">
          <SongForm worldId={worldId} meId={meId} onCancel={() => setSheet(null)} onDone={() => { setSheet(null); router.push("/world/music"); router.refresh(); }} />
        </Sheet>
        <Sheet open={sheet === "letter"} onClose={() => setSheet(null)} title="New letter">
          <LetterForm worldId={worldId} meId={meId} onCancel={() => setSheet(null)} onDone={(id) => { setSheet(null); router.push(`/world/letters/${id}`); router.refresh(); }} />
        </Sheet>
        <Sheet open={sheet === "account"} onClose={() => setSheet(null)} title="Your account">
          <p className="mt-4 font-display text-xl">{me}{partner && <> <span className="italic text-rose">&</span> {partner}</>}</p>
          <p className="mt-1 text-sm text-muted">{worldName}</p>
          <SignOutButton className="mt-4 -ml-4" />
        </Sheet>
      </div>
    </LetterCreateContext.Provider>
    </SongCreateContext.Provider>
    </PlaceCreateContext.Provider>
    </DreamCreateContext.Provider>
    </MemoryCreateContext.Provider>
    </CreateContext.Provider>
  );
}
