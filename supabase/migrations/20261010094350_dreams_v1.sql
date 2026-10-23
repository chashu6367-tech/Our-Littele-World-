-- Our Little World — Dreams v1 (additive; no data is altered or removed)
-- 1) 'in_progress' status. UI labels: dreaming→"Dreaming", planned→"Planned", in_progress→"In progress", achieved→"Completed".
alter type public.dream_status add value if not exists 'in_progress' before 'achieved';

-- 2) Soft delete, same convention as memories/letters/journal_entries.
alter table public.dreams add column if not exists deleted_at timestamptz;
alter table public.dreams add constraint dreams_description_len check (description is null or char_length(description) <= 5000);
create index if not exists dreams_world_live_idx on public.dreams (world_id, created_at desc) where deleted_at is null;
grant update (deleted_at) on public.dreams to authenticated;

-- 3) Read: member AND (own row incl. soft-deleted OR shared and not deleted). Write policies are unchanged (creator only).
drop policy if exists dreams_select on public.dreams;
create policy dreams_select on public.dreams for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or (visibility = 'shared' and deleted_at is null)));
