"use client";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" aria-label={title} initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }} transition={{ type: "spring", damping: 32, stiffness: 340 }}
            className="relative w-full max-w-xl max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-paper p-6 pb-10 shadow-soft sm:rounded-[2rem]">
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl">{title}</h2>
              <button autoFocus onClick={onClose} aria-label="Close" className="grid size-11 place-items-center rounded-full hover:bg-cream"><X size={20} /></button></div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
