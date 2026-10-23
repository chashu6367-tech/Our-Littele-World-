// Runs the REAL lib/music/url.ts (transpiled on the fly) against accept/reject cases and the database rule.
// Usage (after npm install):  node scripts/check-music-url.mjs
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const out = ts.transpileModule(readFileSync(new URL("../lib/music/url.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const dir = mkdtempSync(join(tmpdir(), "musicurl-")); const file = join(dir, "url.cjs"); writeFileSync(file, out);
const { parseSongUrl, safeSongUrl } = require(file);
// Mirror of CHECK songs_external_url_https
const DB = /^https:\/\/[^/@?#\s<>"'\\]+([/?#][^\s<>"'\\]*)?$/;
let pass = 0, fail = 0; const t = (n, c) => (c ? pass++ : (fail++, console.log("FAIL:", n)));
const ok = ["https://open.spotify.com/track/1?si=a", "https://music.apple.com/in/album/x/1?i=2", "https://youtu.be/abc", "https://www.youtube.com/watch?v=1",
  "https://example.com:8443/p?q=1#f", "HTTPS://EXAMPLE.COM/x", "https://example.com./x", "https://evil.com\\@good.com", "https://example.com/a\\b", "https://example.com?x=1", "https://日本語.jp/パス", "  https://example.com/x  ", "https://example.com/it's", "https://münchen.de/x", "https://x.com/<b>", "https://example.com"];
for (const u of ok) { const r = parseSongUrl(u); t("accepts " + u, r.ok); if (r.ok) { t("db-compatible " + u, DB.test(r.url) && r.url.length <= 2000); t("no raw apostrophe " + u, !r.url.includes("'")); } }
t("www stripped", parseSongUrl("https://www.youtube.com/watch?v=1").host === "youtube.com");
t("idn shown as punycode", parseSongUrl("https://münchen.de/x").host.startsWith("xn--"));
const bad = ["", "http://open.spotify.com/x", "javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "vbscript:x", "ftp://x.com/y", "file:///etc/passwd",
  "https://user:pw@x.com/", "https://user@x.com/", "https://localhost/x", "https://127.0.0.1/x", "https://192.168.0.1/x", "https://[::1]/x", "https://exa mple.com",
  "open.spotify.com/x", "//x.com/y", "https:///x", "https://x.com/" + "a".repeat(2000), "https://x.com/\n/a", "https://x.com/\ta",
  "https://localhost./x", "https://foo.localhost/x", "https://foo.localhost./x", "https://a..b.com/x", "https://.example.com/x", "https:example.com", "https:/example.com", "https:\\\\example.com",
  "https://127.0.0.1./x", "https://127.1/x", "https://2130706433/x", "https://0x7f.1/x", "https://[::ffff:127.0.0.1]/x", "https://example.com:99999/x",
  "https://example.com/?a=\\b", "https://example.com/#a\\b", "https://x.com/\u00a0a", "https://x.com/\u3000a", "https://x.com/\u001fa", "https://x.com:pw@y.com", "https://good.com@evil.com"];
for (const u of bad) t("rejects " + JSON.stringify(u).slice(0, 60), !parseSongUrl(u).ok);
t("render guard: null", safeSongUrl(null) === null); t("render guard: javascript:", safeSongUrl("javascript:alert(1)") === null);
t("render guard: http", safeSongUrl("http://x.com/") === null); t("render guard: ok", safeSongUrl("https://open.spotify.com/track/1")?.host === "open.spotify.com");
console.log(`music url helper: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
