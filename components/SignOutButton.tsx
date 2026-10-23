"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await createClient().auth.signOut();
    window.location.replace("/login"); // full navigation: drops the in-memory router cache so Back cannot show signed-in pages
  }
  return (
    <button onClick={signOut} disabled={busy} className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm text-muted transition-colors hover:text-ink disabled:opacity-60 ${className}`}>
      <LogOut size={18} aria-hidden />{busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
