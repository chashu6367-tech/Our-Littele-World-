"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signInMessage } from "@/lib/auth/messages";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setError(signInMessage(error)); setBusy(false); return; }
      router.replace("/world/home");
      router.refresh();
    } catch (err) {
      setError(signInMessage(err as Error)); setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6" style={{ background: "radial-gradient(50rem 34rem at 50% 30%, var(--color-blush), var(--color-paper) 70%)" }}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <p className="eyebrow text-center">Our Little World <span aria-hidden>❤️</span></p>
        <h1 className="mt-4 text-center font-display text-4xl">Welcome <span className="italic text-rose">home</span></h1>
        <p className="mt-3 text-center text-muted">This place is just for the two of you.</p>
        <form onSubmit={onSubmit} className="surface mt-8 space-y-5 p-7" noValidate>
          <div>
            <label htmlFor="email" className="text-sm text-muted">Email</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
              className="mt-1.5 min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60" />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-muted">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
              className="mt-1.5 min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base transition-colors focus:border-rose disabled:opacity-60" />
          </div>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-rose">{error}</p>
          <button type="submit" disabled={busy || !email || !password}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-paper transition-colors hover:bg-rose disabled:opacity-60">
            {busy ? <><Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden />Signing in…</> : "Enter our world"}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
