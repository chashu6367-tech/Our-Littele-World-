-- Our Little World — Phase 6: private Storage for memory media + media record constraints.
-- Path convention (the path is NOT the security boundary; the policies below are):
--   <world_id>/<memory_id>/<random-uuid>.<ext>   in the PRIVATE bucket "memory-media".
-- Read   = a live memory_media row points at the path AND the memory is not deleted AND the caller can see that
--          memory/media row (their RLS applies, so private memories and their media are invisible to the partner).
-- Upload = caller created the (non-deleted) memory, is a member of its world, and the path matches that memory.
-- Remove = caller created the memory.  No UPDATE policy (no overwrite/upsert).

-- 1) Media records: tie each record to its own memory folder, and bound type/size (server-side, not UI-only).
alter table public.memory_media
  add constraint memory_media_path_shape check (
    storage_path ~ ('^' || world_id::text || '/' || memory_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|heic|heif|mp4|mov|webm)$')),
  add constraint memory_media_size_bounds check (file_size is not null and file_size between 1 and 52428800),
  add constraint memory_media_mime_allowed check (
    (media_type = 'image' and mime_type in ('image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'))
    or (media_type = 'video' and mime_type in ('video/mp4','video/quicktime','video/webm')));

-- 2) Private bucket. Storage itself enforces the size limit and MIME allow-list on every upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-media', 'memory-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3) Helpers (SECURITY INVOKER: the caller's own RLS on memories / memory_media still applies).
-- CASE guarantees the regex runs before any uuid cast.
create function private.can_read_memory_object(p_name text) returns boolean
language sql stable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]+$' then exists (
    select 1 from public.memory_media mm
    join public.memories m on m.id = mm.memory_id and m.world_id = mm.world_id
    where mm.storage_path = p_name and mm.deleted_at is null and m.deleted_at is null) else false end;
$$;

create function private.can_upload_memory_object(p_name text) returns boolean
language sql stable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif|heic|heif|mp4|mov|webm)$'
    then exists (
      select 1 from public.memories m
      where m.world_id = split_part(p_name, '/', 1)::uuid and m.id = split_part(p_name, '/', 2)::uuid
        and m.created_by = (select auth.uid()) and m.deleted_at is null and private.is_world_member(m.world_id))
    else false end;
$$;

create function private.owns_memory_object(p_name text) returns boolean
language sql stable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then exists (
      select 1 from public.memories m
      where m.world_id = split_part(p_name, '/', 1)::uuid and m.id = split_part(p_name, '/', 2)::uuid
        and m.created_by = (select auth.uid()))
    else false end;
$$;

revoke execute on function private.can_read_memory_object(text), private.can_upload_memory_object(text),
  private.owns_memory_object(text) from public, anon;
grant execute on function private.can_read_memory_object(text), private.can_upload_memory_object(text),
  private.owns_memory_object(text) to authenticated;

-- 4) Storage policies (authenticated only; anon has none).
create policy memory_media_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'memory-media' and private.can_read_memory_object(name));
create policy memory_media_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'memory-media' and private.can_upload_memory_object(name));
create policy memory_media_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'memory-media' and private.owns_memory_object(name));
