# Security model (Phase 3 — implemented and tested against the live project)

Migrations: `20261007010100_security_rls_v1.sql` + `20261007010351_security_rls_v1_fix_media_insert.sql`.
All 16 tables have RLS and 45 policies, every one `to authenticated`. `anon` has no privileges at all.

**Membership.** A user is a member of a world only if `auth.uid()` equals `partner_one_id` or `partner_two_id`
(`private.is_world_member`). Both partners have identical rights. No client-supplied owner, world, user or recipient is trusted.

**Shared/private.** Only `shared` and `private`. Read = member AND (own row OR shared and not soft-deleted). Write = creator only.
Soft-deleted rows stay visible to their creator only.

**Immutability.** Column-level grants make `id`, `world_id`, `created_by`, `recipient_id`, `reference_id`, `event_type`,
`memory_id` and all timestamps impossible to UPDATE from the client. `visibility` is changeable by the creator.

**Deletes.** No client DELETE anywhere except a user's own reactions. Soft delete = UPDATE `deleted_at`.
Milestones, timeline events and songs have no `deleted_at` yet, so clients cannot remove them. Dreams gained `deleted_at` in `dreams_v1` (applied). Places gained it in `places_v1` (applied 2026-10-11; see the Places section).

**Surprises.** Recipient is always the creator's partner (`private.other_partner`). The recipient sees nothing (no row, title or count)
until `unlock_at`; afterwards may only set `opened_at` once (trigger `private.guard_surprise_update`). Only the recipient can open.

**Media.** Follows the parent memory's RLS. Only the memory's creator can attach media; world must match the memory.

**Polymorphic pointers** (comments, reactions, notifications, activity, timeline references): authorized with
`private.can_see(kind, id, world)`, a SECURITY INVOKER helper, so each target table's own RLS decides. Inserts on unseeable or
nonexistent targets fail identically (no existence oracle). Flipping a record to private hides its comments, reactions,
media, notifications, activity and timeline references from the partner.

**Server-only operations (no client grant):** creating/deleting `couple_worlds` and changing partners; INSERT on `notifications`
and `activity_events`. Generators must never put private text in `title`/`body`.

**Helpers** live in schema `private` (not exposed by the Data API); none is SECURITY DEFINER. The trigger functions
`set_updated_at`, `enforce_single_world_membership` and `guard_surprise_update` have EXECUTE revoked from API roles.
Default privileges for new tables no longer grant anything to `anon`/`authenticated`.

## Phase 4 additions (invitations / consent)
Migration `20261007060253_auth_invitations_v1.sql`. `public.invitations` (RLS on, 3 policies): inviter, invitee **email**, status, expiry.
Clients may only insert `invitee_email` (inviter, status and expiry are database-defaulted) and only revoke their own pending invitation.
Only a *confirmed* email can match an invitation (`private.verified_email`, the single narrow SECURITY DEFINER read of `auth.users`).
`public.accept_invitation(invitation_id)` is the only way a world is created: it derives identity from `auth.uid()`, locks, validates
(expiry, revoked, accepted, profile, both unpaired) and creates the world + marks the invitation accepted atomically.
Missing and not-yours invitations return the same error. The invitee may see the inviter's profile only while a valid invitation is pending.
Assumptions to keep true in the dashboard: Confirm email ON, public sign-ups OFF.

## Phase 6 — Memories media (migration `20261008144558_memories_storage_v1`)
- Private bucket `memory-media` (50 MB, image/video MIME allow-list enforced by Storage). Path: `<world_id>/<memory_id>/<uuid>.<ext>`.
- Storage policies (authenticated only): SELECT needs a live `memory_media` row + non-deleted memory + the caller's own RLS visibility; INSERT needs the caller to be the creator of the non-deleted memory in a world they belong to, with a path matching it; DELETE needs creator of the memory. No UPDATE policy.
- `memory_media` CHECKs: path must match its own world/memory, size 1..50 MB, MIME/type allow-list.
- Known limits: signed URLs (1 h) already issued stay valid until they expire after a delete or a shared→private change. Direct SQL deletes on `storage.objects` are blocked by Supabase, so the DELETE policy was verified via its helper function, not a live API delete.
- Phase 6.1 (`20261009003859_memories_storage_v1_select_for_uploader`): Storage inserts are `INSERT ... RETURNING`, which PostgreSQL also checks against the SELECT policy. Because upload precedes the `memory_media` record, the storage SELECT policy now also admits the memory creator (`can_upload_memory_object`). Partner/other users/deleted memories are unaffected (re-tested).

## Phase 6.2 — invitation-free sign-in
Application-code only; no migration. The existing world (`da6ee72b-…`) already links both partners, and `couple_worlds_select` (members only) is the sole membership check used by middleware, `getWorldContext` and `/welcome`. The invitation UI was removed; `invitations`, `accept_invitation` and their policies are unchanged in the database.

## Dreams v1 (migration `20261010094350_dreams_v1`, additive)
- Enum `dream_status` gains `in_progress` (values: dreaming, planned, in_progress, achieved; UI "Completed" = `achieved`; `completed_at` is set iff `achieved`, enforced by an existing CHECK).
- `dreams.deleted_at` added (soft delete, client may UPDATE it; no client DELETE). `dreams_select` now follows the Memories rule: member AND (own row incl. soft-deleted OR shared and not deleted). Insert/update policies and column grants are unchanged (creator only; world/creator immutable).
- Description limited to 5000 chars; partial index `dreams_world_live_idx`.
- Tested against the live project with `supabase/tests/dreams_rls_test.sql` (23 checks, all rolled back).

## Places v1 (migration `20261011033538_places_v1`)
> **STATUS: APPLIED to the live Supabase project on 2026-10-11 as migration version `20261011033538` (`places_v1`).** Verified live: schema, policies, bucket, and both test scripts (37 + 44 assertions, rolled back, no residue). Still NOT verified: the Next.js type-check/build, a real browser session, and real uploads/deletes through the Storage API. Do not treat Places as production-ready until those pass.
> (The `-- NOT yet applied` header comment inside the migration file is historical; the file's SQL is byte-identical to what was applied.)

**Schema (additive).** `places` gains `location_text`, `is_visited` (the only visited/planned distinction), `cover_path` and `deleted_at` (soft delete, same convention as memories and dreams). Checks: `visit_date` only when visited; text lengths; `cover_path` must be exactly `<world_id>/<place_id>/<uuid>.<image ext>` of that same row. `latitude`/`longitude` stay unused (no map/geocoding). Partial index `places_world_live_idx`.

**Grants.** `world_id`/`created_by` stay insert-only. The client may update `location_text`, `is_visited`, `cover_path`, `deleted_at` plus the existing `name`, `description`, `visit_date`, `visibility`. No client DELETE.

**Row access.** `places_select`: member AND (own row, including soft-deleted, OR shared and not deleted). Insert/update policies are unchanged (creator only). A soft-deleted place therefore stays readable by its creator only.

**Polymorphic references (`private.can_see`).** Comments, reactions, notifications, activity and timeline all gate on `private.can_see(kind, id, world)`. The migration replaces the function with `CREATE OR REPLACE` (same signature, owner and grants); the **only** change is the `place` branch, which now also requires `deleted_at is null`. Effect: a soft-deleted place is not a valid target for ANYONE, including its creator — new comments/reactions/timeline events against it are rejected, and existing comments, reactions, notifications and activity pointing at it are hidden from both partners (they reappear if the place is restored). A creator still sees their *own* timeline row (existing rule: own rows are always visible to their author) but the partner never does. The creator can still read the deleted place record itself.
Other kinds are intentionally untouched. Observation, out of scope here: for memories, dreams and similar kinds the creator's RLS still shows their own soft-deleted rows, so `can_see` is still true for the creator for those kinds. Fix per kind when each feature needs it.

**Storage: private bucket `place-media`** (not public; images only: jpeg, png, webp, gif, heic, heif; **10 MB** per file, enforced by the bucket).
- Path convention (the path is not the security boundary, the policies are): `<world_id>/<place_id>/<random-uuid>.<ext>`.
- Read (`place_media_objects_select`): a live (not soft-deleted) place that the caller can see (their places RLS applies) has `cover_path` equal to the object — or it is the creator's in-flight upload into their own non-deleted place (needed because Storage inserts run INSERT … RETURNING, same lesson as memories 6.1).
- Upload (`place_media_objects_insert`): the caller created the place, it is not soft-deleted, they are a world member, and the path matches that place.
- Delete (`place_media_objects_delete`): the caller created the place (even if soft-deleted, so covers can be cleaned up).
- No UPDATE policy (no overwrite). `anon` has no policy. Helpers (`private.can_read_place_object`, `can_upload_place_object`, `owns_place_object`) are SECURITY INVOKER with `EXECUTE` for `authenticated` only.

**Tests** (each runs in a sub-transaction that always rolls back): `supabase/tests/places_rls_test.sql` (row access + storage, 37 checks) and `supabase/tests/places_can_see_test.sql` (polymorphic references, 44 checks). Both ran against the live schema after the migration was applied (all assertions true, all data rolled back).

## Music v1 (migration `20261011120000_music_v1`)
> **STATUS: APPLIED to the live Supabase project (authorised by the owner).** The migration tool recorded it as `music_v1` with its own timestamp `20261012024855`; after verifying exactly one such row, the row's version was corrected to `20261011120000` to match the repo filename (one guarded `UPDATE`, one row affected). The stored statements are byte-identical to `supabase/migrations/20261011120000_music_v1.sql`. **DO NOT re-run it.** After applying, the three SQL suites (Music 58, Places can_see 44, Places RLS 37 assertions) passed against the live schema in rolled-back sub-transactions and left no rows or storage objects behind. Still NOT verified: the real `npm install` / type-check / production build and a real browser session against the live database. (The `NOT applied until explicitly authorised` header comment inside the migration file is historical; the file was deliberately left byte-identical to the applied SQL.)

**Why a migration was required.** The existing `songs` table (title, artist, external_url, description, created_by, timestamps) had no `visibility` and no `deleted_at`, and `songs_select` was member-only, so private songs and soft delete were impossible. The table has 0 rows.

**Schema.** Adds `visibility` (`shared`/`private`, default `private` like every other table) and `deleted_at`. Replaces the weak `songs_external_url_check` (`^https?://`) with `songs_external_url_https`: HTTPS only, no `user:password@`, no whitespace/quotes/angle brackets/backslashes, max 2000 chars. Adds `artist` ≤ 200 and `description` (album / notes) ≤ 2000. Partial index `songs_world_live_idx`.
**Deliberately not added:** `memory_id` (a safe link needs triggers so a shared song can never point at a private memory, and re-checks when a memory flips to private; later phase) and `cover_url` (loading arbitrary third-party images leaks viewer IPs; the UI draws a generated artwork tile).

**Grants / policies.** `world_id`/`created_by` stay insert-only; client may update `title, artist, external_url, description` (existing) plus `visibility, deleted_at`; no client DELETE. `songs_select` becomes: member AND (own row incl. soft-deleted OR shared and not deleted). `songs_insert`/`songs_update` are unchanged (creator only). `private.can_see` is replaced via `CREATE OR REPLACE`; **only** the `song` branch changes (adds `deleted_at is null`), so a soft-deleted song is not a valid target for comments, reactions, notifications, activity or timeline references. Private songs were already hidden from `can_see` once `songs_select` is fixed (it runs under the caller's RLS).

**Links (no hosting, no playback).** Only metadata and an external HTTPS link are stored. The app validates with the platform `URL` parser (`lib/music/url.ts`), re-validates every stored link at render time, shows the destination host, and opens it with `target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer"`. No iframes, no embeds, no fetching, no scraping, no third-party API, no playback or preview.
Division of labour: the database CHECK is the hard floor (HTTPS, no credentials, no whitespace/quotes/angle brackets/backslashes, <= 2000 chars). The app helper is deliberately stricter and also rejects: bare/`localhost`/`*.localhost` hosts (also with a trailing dot), IP addresses (including decimal/hex/short forms), empty hostname labels, inputs not literally starting with `https://`, and anything the parser would only accept after "repairing" it. Every link the helper emits is ASCII-only and normalised (host lower-cased/punycode, odd characters percent-encoded, apostrophe -> `%27`), and a differential test confirmed the database accepts all of them. Values written directly to the database that the app would reject (e.g. `https://localhost`) are stored but never rendered as links.

**Rollback.** `supabase/rollbacks/20261011120000_music_v1_down.sql` (executable; deliberately outside `supabase/migrations`). Run it as ONE script: it is a single transaction (`begin` ... `commit`) holding an ACCESS EXCLUSIVE lock on `songs`, so it is all-or-nothing and nothing can be inserted between its checks and its drops. It refuses (changing nothing) when: music_v1 is not applied; any private song exists (would become visible to the partner); any soft-deleted song exists (would be resurrected); any `external_url` would violate the ORIGINAL check (`^https?://`, case-insensitive; note a song that satisfies the new HTTPS check always satisfies the original, and `http://` URLs are legal under the original and are kept); or `private.can_see` / `songs_select` no longer equal what music_v1 installed (a later migration changed them). It re-adds the original constraint FIRST, restores the old policy and the places_v1 `can_see`, drops the new objects, and removes the `music_v1` row from the migration history (so apply the migration with the name `music_v1`). Afterwards redeploy the previous app version (the Music page reads the dropped columns). Verified in rolled-back transactions (19 checks): clean rollback restores columns, constraints, grants, policies, indexes, trigger, `can_see` text and privileges exactly; rollback with real data keeps every field byte-identical; every guard refuses; a step failing midway leaves the post-migration schema untouched.

**Procedure that was followed to apply it (historical record; do not repeat)** (migration and tests are separate transactions on purpose):
1. Apply the SQL of `supabase/migrations/20261011120000_music_v1.sql` with the apply_migration tool, name `music_v1`. It runs as one transaction, commits on its own, and records the migration with its statements. The tool chooses the version timestamp itself and cannot be told which one to use.
2. Align the history version with the repo filename: `update supabase_migrations.schema_migrations set version = '20261011120000' where name = 'music_v1';` (exactly one row; this is what `supabase migration repair` does). Then confirm read-only: one row `20261011120000 / music_v1`, it is the latest, `songs.visibility`/`deleted_at` exist, and the new constraint, policy and function are present. If you would rather not touch the history, skip the update and rename the repo file to the stamped version instead; never leave the two different.
3. Run `music_rls_test.sql`, `places_can_see_test.sql`, `places_rls_test.sql` (each in its own call, ids filled in). They contain no DDL, never touch the migration history, and every fixture change happens inside a sub-transaction that always ends in `RAISE EXCEPTION`, so it is rolled back; a crash aborts the whole statement, which also persists nothing. Because the migration was committed in step 1, rolling back a test cannot unapply it.
4. Read-only residue checks: no `T-` rows, no objects in `place-media`, your memory photos and counts unchanged.

**Running the rollback script safely.** It supplies its own `begin;`/`commit;` and `lock table`, so run it as a single script with `psql -v ON_ERROR_STOP=1 -f` or by pasting the whole file into the SQL editor. Never run it through apply_migration, `supabase db push`, or from `supabase/migrations` (they open their own transaction and record migrations). If a runner already wraps scripts in a transaction, remove only its first `begin;` and last `commit;`. On any refusal or error the transaction aborts and the final `commit;` acts as a rollback, so nothing changes. The `begin`/`lock`/`commit` shape was checked on this project's SQL runner with a temporary table (persists on commit, lock released); the guards and steps were tested in rolled-back transactions.

**Tests.** `supabase/tests/music_rls_test.sql` (58 assertions, each scenario rolls back; run after the migration is applied) and `scripts/check-music-url.mjs` (96 checks of the real `url.ts`: `node scripts/check-music-url.mjs`).
