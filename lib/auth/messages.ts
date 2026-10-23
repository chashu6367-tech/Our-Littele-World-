type Err = { message?: string; code?: string; status?: number } | null | undefined;
const dev = (where: string, e: Err) => { if (process.env.NODE_ENV !== "production") console.error(`[${where}]`, e); };

export function signInMessage(e: Err): string {
  dev("sign-in", e);
  const m = (e?.message ?? "").toLowerCase();
  if (e?.code === "invalid_credentials" || m.includes("invalid login")) return "That email and password don't match.";
  if (e?.code === "email_not_confirmed") return "Please confirm your email address first.";
  if (e?.status === 429 || e?.code === "over_request_rate_limit") return "Too many attempts. Please wait a moment and try again.";
  if (e?.status === 0 || m.includes("fetch") || m.includes("network")) return "We can't reach the server. Check your connection and try again.";
  return "We couldn't sign you in. Please try again.";
}

export function genericMessage(e: Err, where = "request"): string {
  dev(where, e);
  return "Something went wrong. Please try again.";
}
