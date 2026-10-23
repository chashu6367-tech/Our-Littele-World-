-- Phase 6.1: Storage inserts run as INSERT ... RETURNING, which PostgreSQL also checks against the SELECT policy.
-- Upload happens before the memory_media record exists, so the memory's creator must be able to see the object they
-- are uploading into their own (non-deleted) memory folder. can_upload_memory_object() is creator-only, so the partner,
-- other users and anyone targeting deleted/foreign memories gain nothing.
drop policy memory_media_objects_select on storage.objects;
create policy memory_media_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'memory-media'
    and (private.can_read_memory_object(name) or private.can_upload_memory_object(name)));
