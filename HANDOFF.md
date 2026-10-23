# Our Little World ❤️ — Final Handoff (for the next Claude chat)

*Two people. One world. Equal control. A lifetime of memories.*

> **Read this first.** This file preserves the state of the project at the end of a long chat that hit its usage limit. It is written from facts verified in that chat. Where something was **not** verified, it says so. Do not upgrade "blocked", "mocked" or "not run" items into successes without actually running them.
> Handoff date: **October 17, 2026**. Everything described as "live" refers to the connected Supabase project.

---

## 0. The five things that matter most

1. **The Music migration (`supabase/migrations/20261011120000_music_v1.sql`) is ALREADY APPLIED** to the live database (history row `20261011120000 music_v1`). **Never re-run it.** Never re-run any applied migration. Never reset the database or drop tables.
2. **The real Next.js app has never been built or run in a real browser.** `npm install`, `npm run typecheck` and `npm run build` were blocked in the previous environment (no network, no npm registry). Everything reported as "passed" was SQL tests, mocked component tests, or a hand-stubbed type-check. See §E.
3. **There is no `package-lock.json`.** The first successful `npm install` must create it. Do not fabricate one.
4. **GitHub is NOT connected and must stay disconnected** until the owner explicitly asks. Do not assume the latest source is on GitHub: **this ZIP is the source of truth.**
5. **Privacy is enforced by PostgreSQL RLS, not by the UI.** Exactly two visibility states exist: `shared` and `private`. Never add a third.

---

## A. Project overview

**What it is.** A private shared digital home for exactly two people, **Yashu and Chandana**: relationship, memories, dreams, letters, milestones, places, music, journals, surprises and a shared life. It is *not* a generic CRUD dashboard and *not* just a birthday site. Target feel: personal, premium, emotionally warm, modern, cinematic, memorable, smooth, responsive, polished.

**Equal partnership (absolute).** No admin/primary/owner/privileged partner. Both partners have identical capabilities. Do not introduce role hierarchy.

**Privacy model (absolute).**
- Exactly two states: `shared` (both partners can see) and `private` (only the creator can see). No `for_partner`-style third state.
- Partner-specific experiences (e.g. Surprises) must use **recipient / unlock logic**, not another visibility state.
- Private content must never leak through activity feeds, notifications, search, counts, timelines, dashboards, previews, metadata, API responses, or related-content sections.
- Authorization is enforced in PostgreSQL (RLS, column grants, Storage policies), never only in the UI.

**Stack (do not change without being told).** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Motion 12, Lucide, Supabase (Auth, PostgreSQL, RLS, private Storage), GitHub, Vercel (later).

**Roadmap (14 stages, from the owner's project instructions at the start of the project).** The owner's "Master Architecture" document is referenced by the owner but **was never uploaded in the previous chat** — its contents are not known and must not be guessed. **Ask the owner to upload it in the new chat** and reconcile it with this list before planning.
1. Foundation and repository setup · 2. Supabase/database architecture · 3. Authentication · 4. Application shell · 5. Home / Our Story · 6. Memories and media · 7. Letters and journal · 8. Dreams / Places / Music · 9. Surprises · 10. Notifications / Activity · 11. Birthday experience · 12. Backup / export / recovery · 13. Final security, performance, accessibility and visual polish · 14. Vercel deployment.

**Where the project actually stands against that list.** Stages 1–4 done (not build-verified). Stage 5: Home done, "Our Story" is a placeholder. Stage 6 (Memories) done. Stage 8 (Dreams, Places, Music) done — built *before* stage 7. **Not started:** stage 7 (Letters, Journal), 9 (Surprises), 10 (Notifications/Activity UI and generator), 11 (Birthday), 12, 13, 14.

**Birthday milestone.** The owner intends a **December 19, 2026** birthday milestone (stated by the owner; no further spec was available). As of this handoff that is about **9 weeks away**, and stage 11 (and its prerequisites) is not started. **Early in the new chat, ask the owner what the birthday experience must contain and which earlier stages it depends on, then agree a realistic scope.** Do not invent features.

**Working style the owner requires.** Phase-by-phase, minimal and verified. Read the current state first, reuse existing work, do only the requested phase, do not build ahead, do not duplicate, never claim "implemented/working/secure/production-ready" unless verified, and end each task with a short *Changed / Verified / Not Changed / Blockers* report. Priorities: correctness → security → maintainability → UX → visual quality → performance. The owner uses the Claude Free tier: be efficient.

---

## B. Technical architecture

### B1. Dependencies (exact ranges from `package.json`; no lockfile, so the first install resolves the newest allowed versions)
| Package | Range |
|---|---|
| next | ^15.5.0 |
| react / react-dom | ^19.1.0 |
| @supabase/ssr | ^0.7.0 |
| @supabase/supabase-js | ^2.58.0 |
| motion | ^12.0.0 |
| lucide-react | ^0.468.0 |
| tailwindcss, @tailwindcss/postcss (dev) | ^4.1.0 |
| typescript (dev) | ^5.7.0 |
| @types/node / @types/react / @types/react-dom (dev) | ^22 / ^19 / ^19 |

Scripts that exist (do not invent others): `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `typecheck` (`tsc --noEmit`). **There is no `lint` script and no ESLint.** No `engines`/`packageManager`/`.nvmrc`/`.npmrc`. Recommended Node: 20 or 22 LTS (Tailwind 4 expects Node 20+; unverified here).

### B2. Environment variables (names only; never values)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — **publishable key only, never a service-role/secret key.** They live in `.env.local` (git-ignored; `.gitignore` covers `.env*`). `.env.example` contains the names only. **These `NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so create `.env.local` *before* `npm run build`.** They are read lazily at request time (`lib/supabase/env.ts` throws if missing), so the build itself should not need them.

### B3. Directory structure
```
app/                       routes (see B4)           middleware.ts   route guard (/login, /welcome, /world/*)
components/                Sheet, WorldShell, CreateContext, Providers, StateCard, SignOutButton
features/                  home, memories, dreams, places, music (UI)
lib/auth/messages.ts       friendly error messages (hides DB text)
lib/data/                  server-side data access: world, home, memories, dreams, places, music
lib/supabase/              client.ts (browser), server.ts (server), env.ts
lib/{memories,places}/media.ts   upload rules mirroring bucket limits
lib/dreams/status.ts · lib/music/url.ts · lib/nav.ts · lib/format.ts
types/                     TypeScript types per feature
supabase/migrations/       9 applied migrations (see D)
supabase/rollbacks/        20261011120000_music_v1_down.sql (guarded, executable, NOT a migration)
supabase/tests/            dreams_rls_test.sql, places_rls_test.sql, places_can_see_test.sql, music_rls_test.sql
supabase/RLS_REQUIREMENTS.md   security contract + per-migration notes (read it)
scripts/check-music-url.mjs    96 checks of the real lib/music/url.ts
HANDOFF.md (this file)
```

### B4. Routes and entry points
`/` (landing, client component) · `/login` · `/welcome` (recovery for an account with no world; creates nothing) · `/world/home` · `/world/memories` and `/world/memories/[id]` · `/world/dreams` · `/world/places` and `/world/places/[id]` · `/world/music` · `/world/[section]` (placeholder for every not-yet-built section: story, letters, surprises, journal, us, settings). Boundaries: `app/error.tsx`, `app/not-found.tsx`, `app/world/loading.tsx`, `app/world/memories/[id]/not-found.tsx`. Navigation (11 items) is defined in `lib/nav.ts`; the "Add to our world" sheet in `components/WorldShell.tsx` opens real forms for Memory, Dream, Place and Song and a "not available yet" note for the rest. `app/layout.tsx` loads Fraunces + Inter via `next/font/google` and wraps the app in `Providers` (reduced-motion aware).

### B5. Authentication and Supabase integration
- Email + password via Supabase Auth. **No sign-up screen.** README instructs (dashboard, manual, **unverified**): keep *Confirm email* ON; turn *Allow new users to sign up* OFF; create the two users manually. **The next chat must ask the owner to confirm these dashboard settings; they cannot be checked from the repo.**
- `middleware.ts` guards `/login`, `/welcome`, `/world/*`. `getWorldContext` (`lib/data/world.ts`) resolves the signed-in member, the partner's display name and the world, server-side, under RLS. A signed-in account with no world lands on `/welcome`.
- Clients cannot create worlds (no INSERT policy on `couple_worlds`). Invitation tables/functions exist in the database but have **no UI**.
- Browser code uses only the publishable key; data access runs under the signed-in user's RLS. **Never use or request a service-role key in client code or in chat.**

### B6. Database design (verified against the live project)
**17 public tables, all with RLS enabled:** `profiles, couple_worlds, memories, memory_media, letters, surprises, milestones, timeline_events, dreams, places, journal_entries, songs, comments, reactions, notifications, activity_events, invitations`.

**Enums:** `visibility_state` (`shared`,`private`) · `content_kind` (`memory,letter,surprise,milestone,dream,place,journal_entry,song`) · `dream_status` (`dreaming,planned,in_progress,achieved`; the UI says **Completed** for `achieved` and never writes `dreaming`) · `media_kind` · `activity_kind` · `reaction_kind` · `notification_kind` · `timeline_event_kind` · `invitation_status`.

**Tables with `visibility`:** dreams, journal_entries, letters, memories, milestones, places, songs, timeline_events. **Tables with soft delete (`deleted_at`):** comments, dreams, journal_entries, letters, memories, memory_media, places, songs, surprises. (`milestones` and `timeline_events` have **no** `deleted_at` and no UI yet.)

**Authorization rules (the pattern every feature reuses).**
- Row read: *world member* AND (*own row, including soft-deleted* OR (`visibility='shared'` AND not soft-deleted)). Insert/update: creator only; `world_id` and `created_by` are insert-only columns (column-level grants), so ownership cannot be changed or spoofed. **There is no client DELETE** (the only exception is a user deleting their own reactions); "delete" in the UI is a soft delete (`deleted_at`).
- `private.can_see(kind, id, world)` gates comments, reactions, notifications, activity and timeline references. It runs under the caller's RLS. For **places and songs** it also excludes soft-deleted rows (done in places_v1 / music_v1).
- Helper functions in the `private` schema: `is_world_member, can_see, timeline_ref_visible, other_partner, verified_email, guard_surprise_update, can_read/can_upload/owns_memory_object, can_read/can_upload/owns_place_object`. `anon` has no EXECUTE on them.
- `updated_at` triggers exist (e.g. `songs_set_updated_at`).
- Policy counts at the final check: **48 policies on public tables, 6 on `storage.objects`.**

**Storage (both buckets private; access only through policies + short-lived signed URLs, 1 hour):**
| Bucket | Limit | Types | Path convention | Notes |
|---|---|---|---|---|
| `memory-media` | 50 MB | jpeg, png, webp, gif, heic, heif, mp4, quicktime, webm | `<world_id>/<memory_id>/<uuid>.<ext>` | up to 12 files per memory (client rule) |
| `place-media` | 10 MB | jpeg, png, webp, gif, heic, heif | `<world_id>/<place_id>/<uuid>.<ext>` | one optional cover per place; `places.cover_path` must match the row's own folder (CHECK) |
Storage policies: read = a live, visible row points at the object (or it is the creator's in-flight upload); upload/delete = the row's creator only; no UPDATE/overwrite policy. Music uses **no** Storage (external links only).

### B7. Design system
Tokens (from `app/globals.css`): paper `#faf6f0`, cream `#f4ece1`, ink `#2b2124`, muted `#7a6b6e`, rose `#a8485a`, blush `#f1dcd8`, gold `#b98f55`; Fraunces (display) + Inter; `.surface` cards, `.eyebrow` labels; global `:focus-visible` ring. Patterns reused by every feature: eyebrow + large serif headline with one italic rose word, empty states with a clear call to action, bottom-sheet forms (`Sheet`), Shared / "Only me" visibility cards, inline friendly errors, soft-delete confirmation, minimum 44 px touch targets.

---

## C. Feature status

Legend — **Implemented** = code exists in this package. **Tested** = what was actually run. **Unverified** = never run.

| Area | Implemented | Tested (what, and where) | Unverified / known limitations |
|---|---|---|---|
| **Memories** (`/world/memories`, `[id]`) | List, detail, create/edit form, photo/video upload to `memory-media`, soft delete, Shared/Only me | Live data exists (4 memories, 2 media rows, 2 photos) from earlier sessions. `can_see` memory branch covered by `places_can_see_test.sql` | **No dedicated Memories RLS test script exists.** Next.js code never compiled/browser-tested in the last environment. Real upload/delete through the Storage API not re-verified in the last chat |
| **Dreams** (`/world/dreams`) | Grouped list (In progress / Planned / Completed), create/edit, Start / Mark completed / Reopen, soft delete | `dreams_rls_test.sql` (23 assertions) passed on the live schema when applied; stubbed type-check; standalone HTML test page | Not re-run after later migrations. Next.js UI never built/browser-tested. For dreams, a creator's `can_see` is still true for their own soft-deleted rows (see §H) |
| **Places** (`/world/places`, `[id]`) | Card list with visited/planned filter, detail page, create/edit, optional cover photo, soft delete | `places_rls_test.sql` (37) + `places_can_see_test.sql` (44) passed live, rolled back | **Cover-photo upload/delete through the real Storage API was never tested** (only SQL-level policy checks; Supabase blocks direct SQL deletes on `storage.objects`). UI never browser-tested |
| **Music** (`/world/music`) | Song cards, create/edit, Shared/Only me, https-only external links, soft delete, generated artwork tile | `music_rls_test.sql` (58) passed live, rolled back; URL helper 96/96; 55 mocked-component browser checks in headless Chromium; 10 data-layer checks; v5 mobile Save-button fix verified (regression test fails on old code, passes on fix) | Real Next.js app never built/browser-tested. No playback, previews or embeds (by design). `memory_id` link and cover-art URL deliberately **not** built. Link rules for hosts like `https://localhost` are enforced only in the app helper, not the database |
| **Home & navigation** | World Home (identity, empty state, RLS-filtered previews of memories, milestones, dreams); 11-item navigation; "Add to our world" | Static review | Home has **no places/songs previews** (intentional, nothing leaks). Not browser-tested |
| **Auth & partner access** | Login, middleware guard, `/welcome`, equal partners, RLS membership checks | RLS membership paths exercised by every SQL suite (unrelated and anonymous users denied) | Real sign-in flow, middleware redirects and dashboard auth settings **unverified** |
| **Shared components & accessibility** | `Sheet` (dialog: role/aria-modal/label, Escape, autofocus on Close), friendly errors, global focus ring, reduced motion | Static class scan: every control ≥ 44 px; labels/names verified in mocked tests | **Known defect: `Sheet` has no focus trap and does not return focus to the opener** (focus can leave an open dialog; after closing, focus lands on `<body>`). Not fixed |
| **Testing / build / responsive** | — | See §E | Real install/type-check/build **blocked**; real-browser and Tailwind-rendered responsive checks **not run** |
| **Not built (placeholders)** | Our Story, Surprises, Journal, Us, Settings, Milestones UI, notifications/activity UI | Tables + RLS exist for most | No UI. Notification/activity rows can only be created by a privileged server-side path that does not exist yet |

---

## D. Supabase state

- **Project reference:** `kklvlujvyyefmydeeuyo` · **URL:** `https://kklvlujvyyefmydeeuyo.supabase.co`. No secret or credential belongs in this file or in chat.
- **Migration history (live, 9 rows) and repo files — versions match:**

| Version | Name | Purpose |
|---|---|---|
| 20261007005229 | schema_v1 | 17 tables, enums, constraints, indexes, triggers |
| 20261007010100 | security_rls_v1 | RLS on all tables, helper functions, grants, policies |
| 20261007010351 | security_rls_v1_fix_media_insert | media-insert policy fix |
| 20261007060253 | auth_invitations_v1 | invitation tables/functions (no UI) |
| 20261008144558 | memories_storage_v1 | `memory-media` bucket + policies |
| 20261009003859 | memories_storage_v1_select_for_uploader | uploader in-flight read |
| 20261010094350 | dreams_v1 | `in_progress` status, `dreams.deleted_at`, select policy |
| 20261011033538 | places_v1 | place columns, `place-media` bucket + policies, `can_see` place branch |
| **20261011120000** | **music_v1** | `songs.visibility`/`deleted_at`, https-only URL CHECK, select policy, `can_see` song branch |

- **Verified:** the executable SQL of all 8 earlier files equals the SQL stored in the live history (places_v1 is byte-exact; seven differ only in comments). The Music file's hash equals the stored statements (`0f86fc05…`).
- **Music was applied with the migration tool under the name `music_v1`.** The tool stamped its own version (`20261012024855`); after confirming exactly one such row, that one history row was corrected to `20261011120000` to match the filename. **Lesson: the apply tool cannot choose the version. Keep repo filenames equal to the history versions** (the Places file had to be renamed once for this reason).
- **Rollback exists only for Music** (`supabase/rollbacks/20261011120000_music_v1_down.sql`): one transaction, table lock, refuses if private or soft-deleted songs exist, if a URL would violate the original constraint, or if `can_see`/`songs_select` changed since. Never run it unless the owner asks; it needs the previous app version redeployed.

### Letters v1 (plain letters) — MIGRATION APPLIED 2026-10-20 (history version `20261020075753`), RLS TEST EXECUTED, APP NOT BUILD-VERIFIED
- Scope: title, body, Shared/Private (new letters default to **Private**), list `/world/letters`, reading page `/world/letters/[id]`, create (also via the "Add to our world" sheet), edit, creator-only soft delete. No sealed / "Open when…" letters, no recipient/unlock columns, no new visibility state.
- Reuses `public.letters` unchanged (0 rows at the time of writing). Policies `letters_select/insert/update` and all column grants are **unchanged**; fingerprints are asserted in the test (policy md5 `0407aaec…`; catalog-based grant md5 `834dff94…`, role-independent; both taken from the live DB before the migration).
- `supabase/migrations/20261020075753_letters_v1.sql` (applied): `letters_body_check` (non-blank, <= 20,000 chars), partial index `letters_world_live_idx`, and `private.can_see` with only the `letter` branch changed to exclude soft-deleted rows (live body md5 `0d739e4f…` was confirmed identical to the music_v1 text before diffing).
- `supabase/rollbacks/20261020075753_letters_v1_down.sql` (guarded, not a migration) and `supabase/tests/letters_rls_test.sql` (run only AFTER the migration is applied; replace the 3 uuids; every value must be true). Neither has been executed.
- The repo files were renamed to the stamped version after applying (repo follows history, never the reverse). The rollback script finds the history row by name and deletes it by primary key, so it does not depend on the version.
- Read-only validation against the live DB (2026-10-20, nothing written): the new `can_see` body runs over all 8 `content_kind` values with no errors; live body + the one letter-line change = the expected text; the body rule rejects spaces/tabs/newlines/CR/FF/VT-only text and enforces 20,000 chars; `can_see` attributes (sql, stable, invoker, search_path="", p_kind/p_id/p_world, ACL) are what `CREATE OR REPLACE` will write; policy and grant fingerprints re-derived and equal to the values in the test. Then the migration was applied with the project's migration tool (`apply_migration`, name `letters_v1`; it stamped version `20261020075753`; the history row was NOT edited and its recorded statement is byte-identical to `supabase/migrations/20261020075753_letters_v1.sql`, md5 `2a85b1bb…`). The RLS test (70 assertions, one `DO` statement, every write inside a block that always rolls back) was then run once against the live DB and completed without raising (it raises on any false assertion or a wrong count); afterwards read-only checks showed no leftover test rows, `letters` still at 0 rows, history at 10 rows, and policies/grants/constraint/index/function exactly as expected. The ROLLBACK script has NOT been executed. Data layer + components were exercised with a throwaway offline harness (stubbed UI packages): 29 checks passed. `npm install` / typecheck / lint / `next build` still have not run (no network in the authoring sandbox; the project has no ESLint config).
- Files: `types/letters.ts`, `lib/data/letters.ts`, `features/letters/*`, `app/world/letters/**`, plus small additive edits in `components/CreateContext.tsx`, `components/WorldShell.tsx`, `lib/format.ts` (`fmtWritten`). The list shows up to 100 letters (no pagination yet).
- **Historical snapshot, NOT guaranteed live counts** (last read-only check in the previous chat): profiles 2, couple_worlds 1, auth users 2, memories 4, memory_media 2, dreams 2 (one per partner, one private), places 0, songs 0, storage objects 2 (both `memory-media`), `place-media` objects 0, test rows 0.
- **Standing rules.** The Music migration is applied: **do not rerun, recreate or alter its history.** Do not reset the database or drop tables. **Do not remove, overwrite or clean up real user data without explicit authorization.** The existing memory photos and the current Memories/Dreams data must be preserved. Never edit an applied migration file (the header comment `-- NOT yet applied…` inside the Places/Music files is historical; the files are deliberately byte-identical to the applied SQL). Fix documentation in docs, not in applied migrations.

---

## E. Verification report (what actually ran, and what did not)

| Check | Result | Evidence / reason |
|---|---|---|
| `npm install` | **BLOCKED** | Previous environment had no network (`registry.npmjs.org` did not resolve; `npm view` timed out). No lockfile exists |
| TypeScript type-check (`tsc --noEmit`, real) | **BLOCKED** | 926 errors, all from missing dependencies (88 missing modules, 738 "JSX has no types", cascades such as `notFound()` not narrowing). Only TypeScript 6.0.3 was available, not the project's 5.x |
| Supplementary type-check against hand-written stubs | PASS (partial) | Strict, exit 0, caught 3 injected Music defects. **Not a substitute for the real type-check** |
| Production build (`next build`) | **BLOCKED** | Dependencies not installed |
| SQL security suites on the live schema (rolled-back sub-transactions) | PASS | Music 58, Places can_see 44, Places RLS 37 = **139 assertions**, no residue; Dreams 23 earlier. Not re-run in the final hand-off turn |
| URL helper `scripts/check-music-url.mjs` | PASS | 96/96 on the final tree |
| Mocked component tests in headless Chromium (real Music components, mocked libs/Supabase) | PASS | 55/55 on the final tree. **Not the Next.js app; Tailwind not loaded** |
| Data-layer tests (real `getSongs`, mocked server client) | PASS | 10/10 |
| Real browser tests of the actual app against the live database | **NOT RUN** | App never built |
| Responsive visual tests of the real app (Tailwind) | **BLOCKED** | Tailwind not installed; only static class review (every control ≥ 44 px, mobile-first). One layout defect (Save button moving on blur) was found by measurement and fixed |
| Real Storage API upload/delete (memories, place covers) | **NOT RUN** | Only SQL-level policy checks |
| Security/privacy | PASS at database level; UI level only in mocks | RLS suites above; UI exposes no edit/delete on partner rows; partner private rows absent from rendered output in mocks |
| `Our_Little_World_Chrome_Preview.html` in Google Chrome for Testing 131 | PASS | 55 checks, zero network requests, no console errors. **A simulated preview, not the app** |

---

## F. Exact next steps for the new chat (do them in this order)

1. **Receive and inspect this ZIP.** Confirm `features/music/SongForm.tsx` has no `onBlur`; confirm `supabase/migrations/` has 9 files ending `20261011120000_music_v1.sql`; confirm there is no `package-lock.json` and no `.env.local`. Ask the owner for the **Master Architecture** document.
2. **Ask the owner to extract the ZIP to a known Windows folder** (not inside OneDrive or another synced folder) and tell you the path.
3. **Install and run the real checks locally.** Run from the project root (edit the path):
```powershell
Set-Location "C:\path\to\our-little-world"
Test-Path .\package.json                                   # True
Select-String -Path .\features\music\SongForm.tsx -Pattern "onBlur" -SimpleMatch   # prints NOTHING
(Get-FileHash .\features\music\SongForm.tsx -Algorithm SHA256).Hash.Substring(0,16)                       # aef8702a46d28497
(Get-FileHash .\supabase\migrations\20261011120000_music_v1.sql -Algorithm SHA256).Hash.Substring(0,16)   # 0f86fc05b13505de
node -v; npm -v; npm config get registry                   # Node 20 or 22 LTS; https://registry.npmjs.org/
Copy-Item .env.example .env.local; notepad .env.local      # fill the two NEXT_PUBLIC_* values (publishable key only)
npm install 2>&1 | Tee-Object -FilePath install.log        # no lockfile -> npm install, NOT npm ci
"install exit code: $LASTEXITCODE"
npm ls next react react-dom typescript @types/react @supabase/supabase-js @supabase/ssr motion lucide-react tailwindcss --depth=0 2>&1 | Tee-Object -FilePath versions.log
npm run typecheck 2>&1 | Tee-Object -FilePath typecheck.log; "typecheck exit code: $LASTEXITCODE"
npm run build 2>&1 | Tee-Object -FilePath build.log;         "build exit code: $LASTEXITCODE"
```
   If PowerShell blocks `npm.ps1`, use `npm.cmd` instead (no policy change). Never share secrets; ask for log tails only (`Get-Content .\typecheck.log -Tail 80`).
4. **Resolve actual errors without suppressing them.** No `--force`, no `--legacy-peer-deps`, no `npm audit fix --force`, no deleting a lockfile, no editing versions to dodge errors, no `ignoreBuildErrors`, no `@ts-ignore`, no loosening `tsconfig`. Fix genuine type errors in the source, explaining each change. Library versions resolved at install may differ from what was assumed.
5. **Verify in Chrome against the existing Supabase project** (`npm run dev` or `npm run start`), using only the publishable key. This is the live project: the owner's test items should be named `TEST-…`, and remember delete is soft (rows stay). Do not clean up without authorization.
6. **Two-partner shared/private checklist** (two browser profiles, one per partner), for Memories, Dreams, Places and Music: shared visible to both; private visible only to the creator (also check that the private title is absent from the other partner's page source, Ctrl+U); shared→private→shared flips; soft delete disappears for the partner after reload; partner has no Edit/Delete; link validation messages (`http://`, `javascript:`, spaces, `user:pw@`, `localhost`); external links open in a new tab; mobile widths 320/360/390/430 (the Save button must not jump when tapping after typing a bad link); keyboard-only operation; console shows no errors; no third-party requests. Real **Storage** tests: upload a memory photo and a place cover as one partner, confirm the other partner sees the shared ones and not the private ones, then delete.
7. **Fix the `Sheet` focus-management defect** in `components/Sheet.tsx`: trap Tab inside the open dialog, return focus to the element that opened it, keep Escape and autofocus. A working reference implementation (trap + restore + Escape) exists in the dialog code of `Our_Little_World_Chrome_Preview.html`. It is shared by every feature, so test all of them afterwards.
8. **Establish the lockfile.** After a successful install, keep the generated `package-lock.json`; propose (do not silently add) an `engines`/`.nvmrc` pin. Never fabricate a lockfile.
9. **Only then, and only with the owner's approval, plan the GitHub connection.** Repository: `chashu6367-tech/Our-littel-World` (the spelling is deliberate; do not rename). In the previous chat GitHub was never connected: a web fetch of the repo is blocked by robots rules, and Anthropic's documentation describes the GitHub integration as reading repositories as context (via a Project), with nothing found about commit/push. Check which tools you actually have before promising anything. Use a branch + pull request, never push to `main` without being told. Confirm `.gitignore` and that no secret is staged.
10. **Continue the roadmap** per the Master Architecture, without inventing features and without changing the privacy model. Suggested priority given the **December 19, 2026** birthday milestone: agree its scope early; the likely prerequisites are Letters/Journal (stage 7), Surprises (stage 9, recipient/unlock logic — `guard_surprise_update` already exists), Notifications/Activity (stage 10, needs a privileged server-side generator that does not exist), then the Birthday experience (stage 11). Each new feature should follow the established pattern: inspect → propose exact migration → owner approval → apply with a stable name → align the history version → SQL tests in rolled-back sub-transactions → UI → verify.

---

## G. Rules for the new Claude chat

- Do not connect GitHub until the owner explicitly asks.
- Do not rerun applied migrations. Do not reset Supabase. Do not delete or clean up real user data without explicit authorization.
- Never ask the owner to paste secrets. Never request or use a service-role key.
- Preserve the current source; change incrementally; explain which files and migrations change **before** consequential operations. Never apply a migration without the owner's explicit "apply".
- Never claim a test, build, deployment or database operation succeeded unless the output confirms it. Keep mocked/stubbed/standalone results separate from real end-to-end results.
- Follow the Master Architecture; point out conflicts before changing the design. Two visibility states only; equal partners; privacy at the database.
- Do not rename the GitHub repository. Do not commit, push or deploy without being asked.
- End each task with a short Changed / Verified / Not Changed / Blockers report.

---

## H. Known defects, risks and conventions (single list)

1. Real install/type-check/build/browser tests have not run (§E). **Highest priority.**
2. `Sheet` focus trap / focus return missing (§F7).
3. No dedicated Memories RLS test; Dreams suite not re-run after later migrations.
4. For **memories, dreams and similar kinds**, a creator's `can_see` is still true for their own soft-deleted rows (places and songs were fixed). Fix per kind when each feature needs it (comments/reactions/notifications on those kinds).
5. Link rules such as no `localhost`/IP hosts exist only in `lib/music/url.ts`; the database check only enforces https, no credentials/whitespace/quotes, ≤ 2000 chars.
6. Supabase blocks direct SQL `DELETE` on `storage.objects`; delete policies were checked through their ownership functions, not through a real delete.
7. Dashboard Auth settings (no sign-ups, confirm email) are documented but unverifiable from the repo.
8. Notification/activity rows have no client INSERT path by design; the server-side generator is not built.
9. No `package-lock.json`; dependency ranges (`^`) will resolve to the newest allowed versions on first install.
10. Repo migration files were checked against live; only comments differ in 7 older ones. Keep filenames equal to history versions.
11. Obsolete artifacts from the previous chat (not in this ZIP): `our-little-world-phase-7-dreams.zip`, `phase-8-places*.zip`, `phase-9-music*.zip` (v1–v5), `our-little-world-memories-dreams.html` (old standalone Memories+Dreams test page), `music-verification-harness.zip` (component-test harness; its paths are hard-coded to the old sandbox; it must **not** be placed inside the project because `tsconfig.json` includes `**/*.ts(x)`).

---

## I. Standalone files delivered with this handoff
- `Our_Little_World_Final_Project.zip` — this source package (`our-little-world/`).
- `Our_Little_World_Chrome_Preview.html` — single-file **simulated** preview (neutral sample data, no network, no storage, no secrets). Banner, "About this preview" dialog and `HANDOFF` both state what is simulated: the Shared/Only-me filtering is drawn in the browser for demonstration only; real enforcement is RLS. Its dialogs trap and restore focus, which the real app's `Sheet` does not yet do.
- `Our_Little_World_Final_Handoff.md` — a copy of this file.
