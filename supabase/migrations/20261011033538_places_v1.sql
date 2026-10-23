-- Our Little World — Places v1 (additive; NOT yet applied to the live project until explicitly authorised)
-- Reuses: public.places (world_id, name, description, visit_date, created_by, visibility), RLS helpers, updated_at trigger.
-- latitude/longitude are left untouched and unused (no map/geocoding in v1).

-- 1) New columns + constraints (all additive; the table currently has 0 rows)
alter table public.places
  add column location_text text,
  add column is_visited    boolean not null default false,   -- the only visited/planned distinction
  add column cover_path    text,                              -- private Storage object path (bucket "place-media")
  add column deleted_at    timestamptz;                       -- soft delete, same convention as memories/dreams

alter table public.places
  add constraint places_location_text_len   check (location_text is null or char_length(location_text) <= 200),
  add constraint places_description_len     check (description is null or char_length(description) <= 5000),
  add constraint places_visit_date_if_visited check (is_visited or visit_date is null),
  add constraint places_cover_path_shape    check (cover_path is null or cover_path ~ (
    '^' || world_id::text || '/' || id::text
    || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|heic|heif)$'));

create index places_world_live_idx on public.places (world_id, created_at desc) where deleted_at is null;

-- 2) Column grants: ownership columns (world_id, created_by) stay insert-only; cover_path is set after upload (update only).
grant insert (location_text, is_visited) on public.places to authenticated;
grant update (location_text, is_visited, cover_path, deleted_at) on public.places to authenticated;

-- 3) Read policy: member AND (own row incl. soft-deleted OR shared and not deleted). Insert/update policies unchanged.
drop policy places_select on public.places;
create policy places_select on public.places for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or (visibility = 'shared' and deleted_at is null)));

-- 3b) Polymorphic pointers (comments, reactions, notifications, activity, timeline all gate on private.can_see).
-- A soft-deleted place must no longer be a valid target for ANYONE, including its creator (who can still read the place row itself
-- through places_select). Only the 'place' branch changes; every other branch is byte-for-byte the Phase 3 definition.
-- CREATE OR REPLACE keeps the signature, owner and the existing EXECUTE grants (authenticated only).
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

-- 4) Private bucket for cover photos (images only, 10 MB). Path: <world_id>/<place_id>/<random-uuid>.<ext>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('place-media', 'place-media', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Helpers are SECURITY INVOKER: the caller's own RLS on places still applies. CASE guarantees the regex runs before any uuid cast.
create function private.can_read_place_object(p_name text) returns boolean
language sql stable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
    then exists (select 1 from public.places p where p.cover_path = p_name and p.deleted_at is null) else false end;
$$;
create function private.can_upload_place_object(p_name text) returns boolean
language sql stable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|heic|heif)$'
    then exists (select 1 from public.places p
      where p.world_id = split_part(p_name, '/', 1)::uuid and p.id = split_part(p_name, '/', 2)::uuid
        and p.created_by = (select auth.uid()) and p.deleted_at is null and private.is_world_member(p.world_id)) else false end;
$$;
create function private.owns_place_object(p_name text) returns boolean
language sql stable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then exists (select 1 from public.places p
      where p.world_id = split_part(p_name, '/', 1)::uuid and p.id = split_part(p_name, '/', 2)::uuid and p.created_by = (select auth.uid())) else false end;
$$;
revoke execute on function private.can_read_place_object(text), private.can_upload_place_object(text), private.owns_place_object(text) from public, anon;
grant  execute on function private.can_read_place_object(text), private.can_upload_place_object(text), private.owns_place_object(text) to authenticated;

-- Storage policies (authenticated only). Select also allows the creator's in-flight upload (INSERT … RETURNING checks SELECT; same lesson as memories 6.1).
create policy place_media_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'place-media' and (private.can_read_place_object(name) or private.can_upload_place_object(name)));
create policy place_media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'place-media' and private.can_upload_place_object(name));
create policy place_media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'place-media' and private.owns_place_object(name));
-- No UPDATE policy: objects cannot be overwritten.

-- ROLLBACK (manual, if ever needed; no data loss while the table is empty):
--   drop policy place_media_objects_select/insert/delete on storage.objects; drop functions private.*_place_object;
--   delete from storage.buckets where id='place-media'; restore places_select AND private.can_see from security_rls_v1;
--   alter table public.places drop column cover_path, drop column deleted_at, drop column is_visited, drop column location_text;
