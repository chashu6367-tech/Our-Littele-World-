-- Fix: qualify outer columns. Unqualified world_id inside the subquery resolved to memories.world_id (always true).
drop policy media_insert on public.memory_media;
create policy media_insert on public.memory_media for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and deleted_at is null
  and exists (select 1 from public.memories m
              where m.id = memory_media.memory_id and m.world_id = memory_media.world_id
                and m.created_by = (select auth.uid())));
