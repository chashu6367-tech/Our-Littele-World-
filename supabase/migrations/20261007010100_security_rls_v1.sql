-- Our Little World — Phase 3: Security & RLS v1
-- Model: two partners of one couple_world have equal rights. shared = both partners, private = creator only.
-- Authorization derives ONLY from auth.uid() + couple_worlds. Client-supplied ownership fields are never trusted:
-- ownership/world/recipient columns are not UPDATE-able and are checked on INSERT.
-- Helpers are SECURITY INVOKER, so RLS of the tables they read is applied too: nothing here bypasses RLS.

-- ───────────── Helper schema (not exposed through the Data API) ─────────────
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.is_world_member(p_world uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.couple_worlds w
                 where w.id = p_world and (select auth.uid()) in (w.partner_one_id, w.partner_two_id));
$$;

-- The caller's partner in this world (null if the caller is not a member).
create function private.other_partner(p_world uuid) returns uuid
language sql stable set search_path = '' as $$
  select case when w.partner_one_id = (select auth.uid()) then w.partner_two_id
              when w.partner_two_id = (select auth.uid()) then w.partner_one_id end
  from public.couple_worlds w where w.id = p_world;
$$;

-- Can the CALLER see this record? Runs as invoker, so each table's own RLS decides
-- (private rows of the partner and locked surprises are invisible here). Used for every polymorphic pointer.
create function private.can_see(p_kind public.content_kind, p_id uuid, p_world uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(case p_kind
    when 'memory'        then exists (select 1 from public.memories        t where t.id = p_id and t.world_id = p_world)
    when 'letter'        then exists (select 1 from public.letters         t where t.id = p_id and t.world_id = p_world)
    when 'surprise'      then exists (select 1 from public.surprises       t where t.id = p_id and t.world_id = p_world)
    when 'milestone'     then exists (select 1 from public.milestones      t where t.id = p_id and t.world_id = p_world)
    when 'dream'         then exists (select 1 from public.dreams          t where t.id = p_id and t.world_id = p_world)
    when 'place'         then exists (select 1 from public.places          t where t.id = p_id and t.world_id = p_world)
    when 'journal_entry' then exists (select 1 from public.journal_entries t where t.id = p_id and t.world_id = p_world)
    when 'song'          then exists (select 1 from public.songs           t where t.id = p_id and t.world_id = p_world)
  end, false);
$$;

create function private.timeline_ref_visible(p_type public.timeline_event_kind, p_ref uuid, p_world uuid) returns boolean
language sql stable set search_path = '' as $$
  select case when p_type = 'custom' then true
              else private.can_see((p_type::text)::public.content_kind, p_ref, p_world) end;
$$;

-- Surprise update guard: only the creator edits content; only the recipient may set opened_at (once, after unlock).
create function private.guard_surprise_update() returns trigger
language plpgsql set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;            -- privileged server path (no end-user JWT)
  if uid = old.created_by then
    if new.opened_at is distinct from old.opened_at then
      raise exception 'Only the recipient can open a surprise' using errcode = '42501';
    end if;
  elsif uid = old.recipient_id then
    if old.opened_at is not null
       or (new.world_id, new.created_by, new.recipient_id, new.title, new.content, new.unlock_at, new.deleted_at)
          is distinct from (old.world_id, old.created_by, old.recipient_id, old.title, old.content, old.unlock_at, old.deleted_at) then
      raise exception 'Recipients may only mark a surprise as opened' using errcode = '42501';
    end if;
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger surprises_guard_update before update on public.surprises
  for each row execute function private.guard_surprise_update();

-- ───────────── Privileges (least privilege) ─────────────
-- Future tables must not auto-grant anything to API roles.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;

revoke execute on function public.set_updated_at(), public.enforce_single_world_membership(),
                           private.guard_surprise_update() from public, anon, authenticated;
revoke execute on function private.is_world_member(uuid), private.other_partner(uuid),
                           private.can_see(public.content_kind, uuid, uuid),
                           private.timeline_ref_visible(public.timeline_event_kind, uuid, uuid) from public, anon;
grant execute on function private.is_world_member(uuid), private.other_partner(uuid),
                          private.can_see(public.content_kind, uuid, uuid),
                          private.timeline_ref_visible(public.timeline_event_kind, uuid, uuid) to authenticated;

-- anon gets nothing. authenticated gets column-limited rights: world_id / created_by / recipient_id / reference_id
-- / event_type / ids are never UPDATE-able, and there is no client DELETE except a user's own reactions.
grant select on public.profiles, public.couple_worlds, public.memories, public.memory_media, public.letters,
  public.surprises, public.milestones, public.timeline_events, public.dreams, public.places,
  public.journal_entries, public.songs, public.comments, public.reactions, public.notifications,
  public.activity_events to authenticated;

grant insert (id, display_name, avatar_url)                     on public.profiles        to authenticated;
grant update (display_name, avatar_url)                         on public.profiles        to authenticated;
grant update (name, relationship_start_date, cover_image_url)   on public.couple_worlds   to authenticated;
grant insert (world_id, title, description, memory_date, location, created_by, visibility) on public.memories to authenticated;
grant update (title, description, memory_date, location, visibility, deleted_at)           on public.memories to authenticated;
grant insert (memory_id, world_id, storage_path, media_type, file_name, file_size, mime_type, caption, uploaded_by) on public.memory_media to authenticated;
grant update (caption, deleted_at)                              on public.memory_media    to authenticated;
grant insert (world_id, title, body, created_by, visibility)    on public.letters         to authenticated;
grant update (title, body, visibility, deleted_at)              on public.letters         to authenticated;
grant insert (world_id, title, content, created_by, recipient_id, unlock_at) on public.surprises to authenticated;
grant update (title, content, unlock_at, opened_at, deleted_at) on public.surprises       to authenticated;
grant insert (world_id, title, description, milestone_date, created_by, visibility) on public.milestones to authenticated;
grant update (title, description, milestone_date, visibility)   on public.milestones      to authenticated;
grant insert (world_id, title, description, event_date, event_type, reference_id, created_by, visibility) on public.timeline_events to authenticated;
grant update (title, description, event_date, visibility)       on public.timeline_events to authenticated;
grant insert (world_id, title, description, target_date, status, created_by, visibility, completed_at) on public.dreams to authenticated;
grant update (title, description, target_date, status, visibility, completed_at) on public.dreams to authenticated;
grant insert (world_id, name, description, latitude, longitude, visit_date, created_by, visibility) on public.places to authenticated;
grant update (name, description, latitude, longitude, visit_date, visibility) on public.places to authenticated;
grant insert (world_id, title, body, entry_date, created_by, visibility) on public.journal_entries to authenticated;
grant update (title, body, entry_date, visibility, deleted_at)  on public.journal_entries to authenticated;
grant insert (world_id, title, artist, external_url, description, created_by) on public.songs to authenticated;
grant update (title, artist, external_url, description)         on public.songs          to authenticated;
grant insert (world_id, author_id, content_type, content_id, body) on public.comments    to authenticated;
grant update (body, deleted_at)                                 on public.comments       to authenticated;
grant insert (world_id, user_id, content_type, content_id, reaction_type) on public.reactions to authenticated;
grant delete                                                    on public.reactions      to authenticated;
grant update (read_at)                                          on public.notifications  to authenticated;
-- couple_worlds INSERT/DELETE, notifications/activity INSERT: intentionally NOT granted (privileged server path only).

-- ───────────── profiles: own + partner ─────────────
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (select 1 from public.couple_worlds w
             where (w.partner_one_id = (select auth.uid()) and w.partner_two_id = profiles.id)
                or (w.partner_two_id = (select auth.uid()) and w.partner_one_id = profiles.id)));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ───────────── couple_worlds: members read/edit settings; creating/changing partners is server-only ─────────────
create policy couple_worlds_select on public.couple_worlds for select to authenticated
  using ((select auth.uid()) in (partner_one_id, partner_two_id));
create policy couple_worlds_update on public.couple_worlds for update to authenticated
  using ((select auth.uid()) in (partner_one_id, partner_two_id))
  with check ((select auth.uid()) in (partner_one_id, partner_two_id));

-- ───────────── shared/private content WITH soft delete: memories, letters, journal_entries ─────────────
-- Read: member AND (own row incl. soft-deleted  OR  shared and not deleted). Write: creator only.
create policy memories_select on public.memories for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or (visibility = 'shared' and deleted_at is null)));
create policy memories_insert on public.memories for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy memories_update on public.memories for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

create policy letters_select on public.letters for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or (visibility = 'shared' and deleted_at is null)));
create policy letters_insert on public.letters for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy letters_update on public.letters for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

create policy journal_select on public.journal_entries for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or (visibility = 'shared' and deleted_at is null)));
create policy journal_insert on public.journal_entries for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy journal_update on public.journal_entries for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

-- ───────────── shared/private content WITHOUT soft delete: milestones, dreams, places ─────────────
create policy milestones_select on public.milestones for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or visibility = 'shared'));
create policy milestones_insert on public.milestones for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy milestones_update on public.milestones for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

create policy dreams_select on public.dreams for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or visibility = 'shared'));
create policy dreams_insert on public.dreams for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy dreams_update on public.dreams for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

create policy places_select on public.places for select to authenticated using (
  private.is_world_member(world_id) and (created_by = (select auth.uid()) or visibility = 'shared'));
create policy places_insert on public.places for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy places_update on public.places for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

-- ───────────── timeline_events: own visibility rules AND the pointed-to record must be visible to the reader ─────────────
create policy timeline_select on public.timeline_events for select to authenticated using (
  private.is_world_member(world_id) and (
    created_by = (select auth.uid())
    or (visibility = 'shared' and private.timeline_ref_visible(event_type, reference_id, world_id))));
create policy timeline_insert on public.timeline_events for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id)
  and private.timeline_ref_visible(event_type, reference_id, world_id));   -- creator must be able to see what they point at
create policy timeline_update on public.timeline_events for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

-- ───────────── memory_media: inherits the parent memory's authorization ─────────────
create policy media_select on public.memory_media for select to authenticated using (
  exists (select 1 from public.memories m where m.id = memory_media.memory_id and m.world_id = memory_media.world_id)  -- memories RLS applies
  and (deleted_at is null or uploaded_by = (select auth.uid())));
create policy media_insert on public.memory_media for insert to authenticated with check (
  uploaded_by = (select auth.uid()) and deleted_at is null
  and exists (select 1 from public.memories m where m.id = memory_id and m.world_id = world_id and m.created_by = (select auth.uid())));
create policy media_update on public.memory_media for update to authenticated
  using (uploaded_by = (select auth.uid())
         and exists (select 1 from public.memories m where m.id = memory_media.memory_id and m.world_id = memory_media.world_id))
  with check (uploaded_by = (select auth.uid()));

-- ───────────── surprises: recipient/unlock logic (no visibility column) ─────────────
create policy surprises_select on public.surprises for select to authenticated using (
  private.is_world_member(world_id) and (
    created_by = (select auth.uid())
    or (recipient_id = (select auth.uid()) and deleted_at is null and (unlock_at is null or unlock_at <= now()))));
create policy surprises_insert on public.surprises for insert to authenticated with check (
  created_by = (select auth.uid()) and recipient_id = private.other_partner(world_id)   -- recipient is always the other partner
  and opened_at is null and deleted_at is null);
create policy surprises_update_creator on public.surprises for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()));
create policy surprises_update_recipient on public.surprises for update to authenticated
  using (recipient_id = (select auth.uid()) and private.is_world_member(world_id) and deleted_at is null
         and opened_at is null and (unlock_at is null or unlock_at <= now()))
  with check (recipient_id = (select auth.uid()) and opened_at is not null);   -- trigger forbids touching anything else

-- ───────────── songs: world members; creator edits ─────────────
create policy songs_select on public.songs for select to authenticated using (private.is_world_member(world_id));
create policy songs_insert on public.songs for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_world_member(world_id));
create policy songs_update on public.songs for update to authenticated
  using (created_by = (select auth.uid()) and private.is_world_member(world_id))
  with check (created_by = (select auth.uid()) and private.is_world_member(world_id));

-- ───────────── comments / reactions: the target must be visible to the actor AND the reader ─────────────
create policy comments_select on public.comments for select to authenticated using (
  private.is_world_member(world_id) and private.can_see(content_type, content_id, world_id)
  and (deleted_at is null or author_id = (select auth.uid())));
create policy comments_insert on public.comments for insert to authenticated with check (
  author_id = (select auth.uid()) and private.is_world_member(world_id) and private.can_see(content_type, content_id, world_id));
create policy comments_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) and private.is_world_member(world_id) and private.can_see(content_type, content_id, world_id))
  with check (author_id = (select auth.uid()));

create policy reactions_select on public.reactions for select to authenticated using (
  private.is_world_member(world_id) and private.can_see(content_type, content_id, world_id));
create policy reactions_insert on public.reactions for insert to authenticated with check (
  user_id = (select auth.uid()) and private.is_world_member(world_id) and private.can_see(content_type, content_id, world_id));
create policy reactions_delete on public.reactions for delete to authenticated using (
  user_id = (select auth.uid()) and private.is_world_member(world_id));

-- ───────────── notifications / activity: read-only for clients, filtered by what the reader can see ─────────────
create policy notifications_select on public.notifications for select to authenticated using (
  recipient_id = (select auth.uid()) and private.is_world_member(world_id)
  and (reference_type is null or private.can_see(reference_type, reference_id, world_id)));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()) and private.is_world_member(world_id))
  with check (recipient_id = (select auth.uid()));

create policy activity_select on public.activity_events for select to authenticated using (
  private.is_world_member(world_id) and private.can_see(reference_type, reference_id, world_id));
