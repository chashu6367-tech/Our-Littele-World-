-- Our Little World — Letters v1. Additive in effect; NOT applied until explicitly authorised.
-- Reuses public.letters exactly as it is (id, world_id, title, body, created_by, visibility default 'private', timestamps, deleted_at,
-- the letters_set_updated_at trigger, RLS on). The table currently has 0 rows. Plain letters only: no recipient, no unlock, no new
-- visibility state (sealed / "Open when…" letters are a later, separate decision).
-- UNCHANGED on purpose: every policy (letters_select / letters_insert / letters_update) and every column grant. Nothing else is touched.

-- 1) Body rules: not blank, at most 20,000 characters (title already has its own 1..200 check).
--    "Blank" means only spaces, tabs, newlines, carriage returns, form feeds or vertical tabs. NOTE: plain btrim(body) trims SPACES ONLY,
--    so a body of tabs/newlines would have passed; the explicit character list below is what makes those rejected.
--    (\f and \x0b are written as E-string escapes; there is no \v escape in PostgreSQL.) Fails loudly if any existing row violates it.
alter table public.letters
  add constraint letters_body_check check (
    char_length(btrim(body, E' \t\r\n\f\x0b')) > 0
    and char_length(body) <= 20000);

-- 2) Active-letter list index (the list and the reading page only ever ask for non-deleted rows, newest first)
create index letters_world_live_idx on public.letters (world_id, created_at desc) where deleted_at is null;

-- 3) Polymorphic pointers: a soft-deleted letter is no longer a valid target for comments / reactions / notifications / activity /
--    timeline. comments_*, reactions_*, notifications_select, activity_select and timeline refs all call private.can_see, so this one
--    change closes all of them. ONLY the 'letter' branch differs from the live definition (Music v1); CREATE OR REPLACE keeps the
--    signature, owner and grants.
create or replace function private.can_see(p_kind public.content_kind, p_id uuid, p_world uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(case p_kind
    when 'memory'        then exists (select 1 from public.memories        t where t.id = p_id and t.world_id = p_world)
    when 'letter'        then exists (select 1 from public.letters         t where t.id = p_id and t.world_id = p_world and t.deleted_at is null)
    when 'surprise'      then exists (select 1 from public.surprises       t where t.id = p_id and t.world_id = p_world)
    when 'milestone'     then exists (select 1 from public.milestones      t where t.id = p_id and t.world_id = p_world)
    when 'dream'         then exists (select 1 from public.dreams          t where t.id = p_id and t.world_id = p_world)
    when 'place'         then exists (select 1 from public.places          t where t.id = p_id and t.world_id = p_world and t.deleted_at is null)
    when 'journal_entry' then exists (select 1 from public.journal_entries t where t.id = p_id and t.world_id = p_world)
    when 'song'          then exists (select 1 from public.songs           t where t.id = p_id and t.world_id = p_world and t.deleted_at is null)
  end, false);
$$;

-- ROLLBACK: run supabase/rollbacks/20261019190000_letters_v1_down.sql (executable, kept outside supabase/migrations).
