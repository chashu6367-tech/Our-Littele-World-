-- Our Little World — Music v1 (songs). Additive in effect; NOT applied until explicitly authorised.
-- Reuses public.songs (world_id, title, artist, external_url, description, created_by, timestamps, songs_set_updated_at trigger, RLS on).
-- Stores metadata + an external HTTPS link only. No audio, no embeds, no external API. The table currently has 0 rows.
-- Deliberately NOT added: memory_id (would need triggers to stop a shared song pointing at a private memory) and cover_url
-- (loading arbitrary third-party images leaks viewer IPs); the UI draws a generated artwork tile instead.

-- 1) Visibility (the only two states; default 'private' like every other table) + soft delete
alter table public.songs
  add column visibility public.visibility_state not null default 'private',
  add column deleted_at timestamptz;

-- 2) Stricter data rules. The old check allowed plain http and any junk after the scheme; replace it.
--    HTTPS only, no user:password@ in the authority, no whitespace/quotes/angle brackets/backslashes, max 2000 chars.
alter table public.songs drop constraint songs_external_url_check;
alter table public.songs
  add constraint songs_external_url_https check (external_url is null or (
    char_length(external_url) <= 2000
    and external_url ~ '^https://[^/@?#[:space:]<>"''\\]+([/?#][^[:space:]<>"''\\]*)?$')),
  add constraint songs_artist_len      check (artist is null or char_length(artist) <= 200),
  add constraint songs_description_len check (description is null or char_length(description) <= 2000);

create index songs_world_live_idx on public.songs (world_id, created_at desc) where deleted_at is null;

-- 3) Column grants: world_id/created_by stay insert-only; no client DELETE. (insert/update POLICIES are unchanged: creator only.)
grant insert (visibility) on public.songs to authenticated;
grant update (visibility, deleted_at) on public.songs to authenticated;

-- 4) Read policy: member AND (own row incl. soft-deleted OR shared and not deleted). Was: every world member could read every song.
drop policy songs_select on public.songs;
create policy songs_select on public.songs for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or (visibility = 'shared' and deleted_at is null)));

-- 5) Polymorphic pointers: a soft-deleted song is no longer a valid target for comments/reactions/notifications/activity/timeline.
--    Only the 'song' branch differs from the live definition (Places v1); CREATE OR REPLACE keeps signature, owner and grants.
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

-- ROLLBACK: run supabase/rollbacks/20261011120000_music_v1_down.sql (executable, kept outside supabase/migrations).
--   It refuses to run while any private or soft-deleted song exists (dropping the columns would expose or resurrect them).
--   Verified in a rolled-back transaction: after UP then DOWN, the songs columns, constraints, grants, policies, indexes, trigger
--   and private.can_see (identical md5) match the pre-migration state exactly.
