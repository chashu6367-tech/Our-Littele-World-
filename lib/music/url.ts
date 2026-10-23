/**
 * External song links: HTTPS only, parsed with the platform URL parser (never string tricks).
 * The same rules are enforced in the database (songs_external_url_https); this module is the friendly, first line
 * AND the render-time guard, so a stored value that somehow fails the rules is never turned into a clickable link.
 * We store and open links only: no embedding, no fetching, no scraping, no API.
 */
export const MAX_SONG_URL = 2000;
export type UrlCheck = { ok: true; url: string; host: string } | { ok: false; reason: string };
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function parseSongUrl(input: string): UrlCheck {
  const raw = input.trim();
  if (raw.length > MAX_SONG_URL) return { ok: false, reason: "That link is too long." };
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return { ok: false, reason: "Links can't contain spaces." };
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: "Paste the full link, starting with https://" }; }
  if (u.protocol !== "https:") return { ok: false, reason: "Only secure https:// links are supported." };
  if (u.username || u.password) return { ok: false, reason: "Links with a username or password aren't supported." };
  // The user must have typed a real "https://" prefix: the URL parser would otherwise quietly "repair" https:example.com or https:\\example.com.
  if (!/^https:\/\//i.test(raw)) return { ok: false, reason: "Paste the full link, starting with https://" };
  const host = u.hostname.replace(/\.$/, ""); // one trailing dot (DNS root) is legal; check without it so "localhost." can't slip through
  if (!host.includes(".") || IPV4.test(host) || host.startsWith("[") || host === "localhost" || host.endsWith(".localhost") || host.split(".").some((label) => !label))
    return { ok: false, reason: "Please use a normal website link." };
  const href = u.href.replace(/'/g, "%27"); // the database also rejects a raw apostrophe
  if (href.length > MAX_SONG_URL || /["<>\\]/.test(href)) return { ok: false, reason: "That link can't be saved." };
  return { ok: true, url: href, host: host.replace(/^www\./, "") };
}

/** Render-time guard for values read back from the database. */
export function safeSongUrl(stored: string | null): { url: string; host: string } | null {
  if (!stored) return null;
  const r = parseSongUrl(stored);
  return r.ok ? { url: r.url, host: r.host } : null;
}
