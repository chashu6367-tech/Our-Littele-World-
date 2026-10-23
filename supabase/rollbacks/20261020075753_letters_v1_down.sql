-- DOWN for 20261020075753_letters_v1 (manual; NOT run by the migration tooling; keep out of supabase/migrations).
-- Restores the pre-Letters state: private.can_see as installed by music_v1, and no body constraint / live index on public.letters.
-- No letter data is changed, lost, exposed or resurrected by this script (rows are untouched; letters_select is not modified).
-- The only effect of removing the can_see change is that comments/reactions can again be attached to the CREATOR's own soft-deleted
-- letters; the partner still cannot read a deleted letter (letters_select hides it), so nothing becomes visible to the partner.
-- RUN AS ONE SCRIPT (psql -v ON_ERROR_STOP=1 -f, or paste the whole file into the SQL editor). It brings its own BEGIN/COMMIT: never run
-- it through `supabase db push`, the apply_migration tool, or as a file inside supabase/migrations.
-- The guard refuses (changes nothing) when:
--   1. letters_v1 is not applied (letters_body_check missing)
--   2. private.can_see no longer equals what letters_v1 installed (a later migration changed it; restoring the old text would undo that)
--   3. supabase_migrations.schema_migrations exists but does not have the columns this script relies on (version text, name text),
--      or more than one row is named 'letters_v1' (name is NOT unique there).
-- Migration history, verified against the live schema on 2026-10-19: supabase_migrations.schema_migrations(version text PRIMARY KEY,
-- statements text[], name text NULL, created_by text, idempotency_key text UNIQUE, rollback text[]). The history row is therefore located
-- by name and then deleted by its PRIMARY KEY (version) and name together, so exactly one row can ever be removed. If the table does not
-- exist, or no row is named 'letters_v1' (e.g. the migration was run in the SQL editor), nothing is deleted and a NOTICE says so.
-- AFTER a successful rollback: remove or rename supabase/migrations/20261020075753_letters_v1.sql (this script deletes the 'letters_v1'
-- row from the migration history) and redeploy the previous app version only if it matters (the Letters UI does not need these objects).

begin;
lock table public.letters in access exclusive mode;

do $guard$
declare
  -- exact function body (pg_proc.prosrc) written by letters_v1
  expected_can_see constant text := $$
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
  hist_rows int;
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.letters'::regclass and conname = 'letters_body_check') then
    raise exception 'Refusing to roll back letters_v1: it is not applied (letters_body_check missing).';
  end if;
  -- compared with whitespace normalised, so a CRLF checkout of this file (Windows git) still matches what letters_v1 installed
  if regexp_replace((select prosrc from pg_proc where oid = 'private.can_see(public.content_kind,uuid,uuid)'::regprocedure), '\s+', ' ', 'g')
       is distinct from regexp_replace(expected_can_see, '\s+', ' ', 'g') then
    raise exception 'Refusing to roll back letters_v1: private.can_see has changed since letters_v1. Reconcile by hand.';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if (select count(*) from information_schema.columns where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
          and ((column_name = 'version' and data_type = 'text') or (column_name = 'name' and data_type = 'text'))) <> 2 then
      raise exception 'Refusing to roll back letters_v1: supabase_migrations.schema_migrations no longer has text columns version and name. Reconcile by hand.';
    end if;
    execute 'select count(*) from supabase_migrations.schema_migrations where name = $1' into hist_rows using 'letters_v1';
    if hist_rows > 1 then
      raise exception 'Refusing to roll back letters_v1: % migration-history rows are named letters_v1 (expected at most 1). Reconcile by hand.', hist_rows;
    end if;
  end if;
end
$guard$;

-- function first: restore the music_v1 definition (letter branch without the deleted_at filter)
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
    when 'song'          then exists (select 1 from public.songs           t where t.id = p_id and t.world_id = p_world and t.deleted_at is null)
  end, false);
$$;

drop index if exists public.letters_world_live_idx;
alter table public.letters drop constraint if exists letters_body_check;

-- migration history must not claim letters_v1 is still applied: delete exactly the one row (by PRIMARY KEY + name), if there is one
do $hist$
declare
  v text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise notice 'No supabase_migrations.schema_migrations table: migration history left untouched.';
    return;
  end if;
  execute 'select version from supabase_migrations.schema_migrations where name = $1' into v using 'letters_v1';   -- guard proved <= 1 row
  if v is null then
    raise notice 'No migration-history row named letters_v1: migration history left untouched.';
  else
    execute 'delete from supabase_migrations.schema_migrations where version = $1 and name = $2' using v, 'letters_v1';
  end if;
end
$hist$;

commit;
