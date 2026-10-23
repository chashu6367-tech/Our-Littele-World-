-- DOWN for 20261011120000_music_v1 (manual; NOT run by the migration tooling; keep out of supabase/migrations).
-- Restores the pre-Music state of public.songs and private.can_see (the definition from places_v1).
-- RUN AS ONE SCRIPT (psql -f, or paste the whole file into the SQL editor). It is a single transaction holding an ACCESS EXCLUSIVE
-- lock on public.songs, so either every step happens or none does, and no song can be inserted between the checks and the drops.
-- (If it is run statement-by-statement outside a transaction, LOCK TABLE fails immediately: it fails safe.)
--
-- The guard refuses (and changes nothing) when rolling back could lose data, expose data, or not restore the old constraint:
--   1. music_v1 is not applied (columns missing)
--   2. any private song exists  -> dropping `visibility` would show it to the partner (restored songs_select is member-only)
--   3. any soft-deleted song exists -> dropping `deleted_at` would resurrect it
--   4. any external_url would violate the ORIGINAL check ('^https?://', case-insensitive)
--   5. private.can_see or songs_select no longer equal what music_v1 installed (a later migration changed them; restoring the
--      hard-coded old text would silently undo that change; reconcile by hand)
-- Shared, live songs lose no information: visibility is constantly 'shared' and deleted_at constantly NULL for them.
-- AFTER a successful rollback: redeploy the previous app version (the Music page reads songs.visibility/deleted_at), and rename or
-- delete supabase/migrations/20261011120000_music_v1.sql (this script removes the 'music_v1' row from the migration history).

-- HOW TO RUN (safe):
--     psql "$DIRECT_DB_URL" -v ON_ERROR_STOP=1 -f supabase/rollbacks/20261011120000_music_v1_down.sql
--   or paste the WHOLE file into the Supabase SQL editor and run it once.
-- The file brings its own BEGIN/COMMIT, so do NOT run it through anything that already opens a transaction or records migrations:
-- not `supabase db push`, not the apply_migration tool, and never as a file inside supabase/migrations. Those wrap each script in their
-- own transaction (your COMMIT would end theirs early) and would also record the rollback itself as a migration.
-- If a guard refuses or any statement fails, the transaction is aborted and the final COMMIT then acts as a ROLLBACK, so nothing
-- changes (with ON_ERROR_STOP psql also exits and the server rolls the open transaction back).
-- If your runner already wraps scripts in a transaction, delete ONLY the first `begin;` line and the last `commit;` line and keep
-- everything else, including LOCK TABLE.

begin;
lock table public.songs in access exclusive mode;

do $guard$
declare
  -- values produced by music_v1 (whitespace-normalised md5 of the can_see definition; deparsed songs_select predicate)
  expected_can_see constant text := '0fef8c486789a3d9ab18424dfebf25f3';
  expected_select_qual constant text := '(private.is_world_member(world_id) AND ((created_by = ( SELECT auth.uid() AS uid)) OR ((visibility = ''shared''::visibility_state) AND (deleted_at IS NULL))))';
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'songs' and column_name in ('visibility', 'deleted_at')) <> 2 then
    raise exception 'Refusing to roll back music_v1: it is not applied (songs.visibility / songs.deleted_at not both present).';
  end if;
  if exists (select 1 from public.songs where visibility = 'private') then
    raise exception 'Refusing to roll back music_v1: private songs exist (they would become visible to the partner). Export or delete them first.';
  end if;
  if exists (select 1 from public.songs where deleted_at is not null) then
    raise exception 'Refusing to roll back music_v1: soft-deleted songs exist (they would be resurrected). Export or delete them first.';
  end if;
  if exists (select 1 from public.songs where external_url is not null and external_url !~* '^https?://') then
    raise exception 'Refusing to roll back music_v1: some external_url values would violate the original songs_external_url_check.';
  end if;
  if md5(regexp_replace(pg_get_functiondef('private.can_see(public.content_kind,uuid,uuid)'::regprocedure), '\s+', ' ', 'g')) <> expected_can_see then
    raise exception 'Refusing to roll back music_v1: private.can_see has changed since music_v1 (restoring the old text would undo that change). Reconcile by hand.';
  end if;
  if (select qual from pg_policies where schemaname = 'public' and tablename = 'songs' and policyname = 'songs_select') is distinct from expected_select_qual then
    raise exception 'Refusing to roll back music_v1: songs_select has changed since music_v1. Reconcile by hand.';
  end if;
end
$guard$;

-- 1) the ORIGINAL constraint goes back first: guard 4 makes failure impossible, and if it ever happened nothing else has changed yet
alter table public.songs add constraint songs_external_url_check check (external_url is null or external_url ~* '^https?://');

-- 2) policy before columns: the music policy depends on the columns that are about to be dropped
drop policy songs_select on public.songs;
create policy songs_select on public.songs for select to authenticated using (private.is_world_member(world_id));

-- 3) function before columns: the music definition references songs.deleted_at (SQL function bodies are not dependency-tracked)
create or replace function private.can_see(p_kind public.content_kind, p_id uuid, p_world uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(case p_kind
    when 'memory'        then exists (select 1 from public.memories        t where t.id = p_id and t.world_id = p_world)
    when 'letter'        then exists (select 1 from public.letters         t where t.id = p_id and t.world_id = p_world)
    when 'surprise'      then exists (select 1 from public.surprises       t where t.id = p_id and t.world_id = p_world)
    when 'milestone'     then exists (select 1 from public.milestones      t where t.id = p_id and t.world_id = p_world)
    when 'dream'         then exists (select 1 from public.dreams          t where t.id = p_id and t.world_id = p_world)
    when 'place'         then exists (select 1 from public.places          t where t.id = p_id and t.world_id = p_world and t.deleted_at is null)
    when 'journal_entry' then exists (select 1 from public.journal_entries t where t.id = p_id and t.world_id = p_world)
    when 'song'          then exists (select 1 from public.songs           t where t.id = p_id and t.world_id = p_world)
  end, false);
$$;

-- (IF EXISTS: the goal is "these are gone"; a constraint someone already dropped must not abort the rollback. Everything else stays strict.)
drop index if exists public.songs_world_live_idx;
alter table public.songs
  drop constraint if exists songs_external_url_https,
  drop constraint if exists songs_artist_len,
  drop constraint if exists songs_description_len;
alter table public.songs drop column visibility, drop column deleted_at;   -- the column grants go with the columns

-- 4) migration history: the schema no longer contains music_v1, so the history must not claim it does
do $hist$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where name = 'music_v1';
  end if;
end
$hist$;

commit;
