# Our Little World ❤️

A private digital home for exactly two people. *Two people. One little world.*

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 4 · Motion · Lucide · Supabase (Auth, Postgres, RLS).

## Run
```bash
npm install
cp .env.example .env.local     # then fill in your project URL and publishable key (never the service-role key)
npm run dev                    # http://localhost:3000
npm run typecheck && npm run build
```

## Supabase setup (required once, in the dashboard)
1. **Authentication → Providers → Email:** keep **Confirm email ON**.
2. **Authentication → Sign In / Providers:** turn **Allow new users to sign up OFF**. There is no sign-up screen.
3. **Authentication → Users → Add user:** create the two accounts (tick *Auto Confirm User*). Share nothing else.
4. Migrations in `supabase/migrations/` are already applied to the project (`supabase db push` reproduces them elsewhere).

## How people get in
`/login` → `/world/home` for a member of the world (checked server-side via RLS on every request). A signed-in account with no world lands on `/welcome`, a recovery page that creates nothing.
Clients cannot create worlds (no INSERT policy on `couple_worlds`). The invitation tables/functions remain in the database but have no UI. No admin/owner roles: both partners are equal.

## Structure
`app/` routes (`/`, `/login`, `/welcome`, `/world/*`) · `middleware.ts` route guard · `lib/supabase/` clients · `lib/data/world.ts` server data · `lib/auth/messages.ts` friendly errors · `features/` · `components/` · `supabase/` migrations + `RLS_REQUIREMENTS.md`.

## Status
Auth, onboarding, invitations, the security model and the real world Home (identity, empty state, RLS-filtered previews) are in place. **Memories, Dreams, Places, Music and Letters v1** (plain letters: private by default, explicit Shared, creator-only soft delete) are built, and their migrations are applied to the live database (latest: `20261011033538 places_v1`, `20261011120000 music_v1`, `20261020075753 letters_v1`; **never re-run an applied migration**). Sealed / "Open when…" letters, Surprises, Journal, Our Story and the comments/reactions UI are not built yet.

**Not yet verified:** `npm install`, `npm run typecheck`, `npm run build` and real-browser checks against the live project have not been run (the earlier environment had no network). There is no `package-lock.json` yet: the first `npm install` creates it. See **`HANDOFF.md`** for the full state, the verification report and the ordered next steps.
