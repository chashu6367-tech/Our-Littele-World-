-- Our Little World — Database Schema V1 (Phase 2)
-- Structure only. No seed data. RLS is ENABLED on every table with NO policies (deny-all);
-- the actual policies are Phase 3 (see supabase/RLS_REQUIREMENTS.md).
-- Conventions: uuid PKs (gen_random_uuid), timestamptz timestamps, ON DELETE RESTRICT for
-- anything holding relationship content, soft delete via deleted_at where specified.

-- ───────────── Types ─────────────
create type public.visibility_state as enum ('shared', 'private');           -- the ONLY two visibility states
create type public.dream_status     as enum ('dreaming', 'planned', 'achieved');
create type public.media_kind       as enum ('image', 'video');
create type public.reaction_kind    as enum ('love', 'smile', 'hug');
create type public.content_kind     as enum ('memory', 'letter', 'surprise', 'milestone', 'dream', 'place', 'journal_entry', 'song');
create type public.timeline_event_kind as enum ('memory', 'milestone', 'dream', 'place', 'custom');
create type public.notification_kind   as enum ('new_content', 'comment', 'reaction', 'surprise_unlocked', 'milestone_reminder');
create type public.activity_kind       as enum ('created', 'completed', 'unlocked', 'commented');

-- ───────────── Shared trigger: updated_at ─────────────
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

-- ───────────── profiles ─────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────── couple_worlds (exactly two partners) ─────────────
create table public.couple_worlds (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null default 'Our Little World' check (char_length(btrim(name)) between 1 and 80),
  partner_one_id          uuid not null references public.profiles (id) on delete restrict,
  partner_two_id          uuid not null references public.profiles (id) on delete restrict,
  relationship_start_date date,   -- set by the couple; never seeded
  cover_image_url         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint couple_worlds_distinct_partners check (partner_one_id <> partner_two_id),
  constraint couple_worlds_partner_one_unique unique (partner_one_id),
  constraint couple_worlds_partner_two_unique unique (partner_two_id)
);

-- A person may belong to only one world, in either position (cross-position duplicates can't be
-- expressed as a plain constraint). Advisory lock serialises concurrent inserts to close the race.
create function public.enforce_single_world_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('couple_worlds_membership'));
  if exists (
    select 1 from public.couple_worlds w
    where w.id <> new.id
      and (w.partner_one_id in (new.partner_one_id, new.partner_two_id)
        or w.partner_two_id in (new.partner_one_id, new.partner_two_id))
  ) then
    raise exception 'A partner already belongs to another world' using errcode = '23505';
  end if;
  return new;
end $$;
create trigger couple_worlds_single_membership
  before insert or update of partner_one_id, partner_two_id on public.couple_worlds
  for each row execute function public.enforce_single_world_membership();

-- ───────────── memories + media metadata ─────────────
create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid not null references public.couple_worlds (id) on delete restrict,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  memory_date date,
  location    text,
  created_by  uuid not null references public.profiles (id) on delete restrict,
  visibility  public.visibility_state not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint memories_id_world_unique unique (id, world_id)
);

create table public.memory_media (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null,
  world_id     uuid not null,
  storage_path text not null unique,   -- path only; no bucket exists yet (later phase)
  media_type   public.media_kind not null,
  file_name    text not null,
  file_size    bigint check (file_size >= 0),
  mime_type    text,
  caption      text,
  uploaded_by  uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  -- media must belong to the same world as its memory
  constraint memory_media_memory_fk foreign key (memory_id, world_id)
    references public.memories (id, world_id) on delete restrict
);

-- ───────────── letters ─────────────
create table public.letters (
  id         uuid primary key default gen_random_uuid(),
  world_id   uuid not null references public.couple_worlds (id) on delete restrict,
  title      text not null check (char_length(btrim(title)) between 1 and 200),
  body       text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  visibility public.visibility_state not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── surprises (recipient/unlock logic; NOT a visibility state) ─────────────
create table public.surprises (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references public.couple_worlds (id) on delete restrict,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  content      text not null,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  recipient_id uuid not null references public.profiles (id) on delete restrict, -- the other partner
  unlock_at    timestamptz,                -- null = unlocked as soon as created
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint surprises_recipient_not_creator check (recipient_id <> created_by)
);

-- ───────────── milestones / timeline / dreams / places / journal / songs ─────────────
create table public.milestones (
  id             uuid primary key default gen_random_uuid(),
  world_id       uuid not null references public.couple_worlds (id) on delete restrict,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  description    text,
  milestone_date date not null,
  created_by     uuid not null references public.profiles (id) on delete restrict,
  visibility     public.visibility_state not null default 'private',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.timeline_events (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references public.couple_worlds (id) on delete restrict,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  description  text,
  event_date   date not null,
  event_type   public.timeline_event_kind not null,
  reference_id uuid,   -- soft pointer to the source row (no FK: several possible tables)
  created_by   uuid not null references public.profiles (id) on delete restrict,
  visibility   public.visibility_state not null default 'private',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint timeline_reference_required check (event_type = 'custom' or reference_id is not null)
);

create table public.dreams (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references public.couple_worlds (id) on delete restrict,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  description  text,
  target_date  date,
  status       public.dream_status not null default 'dreaming',
  created_by   uuid not null references public.profiles (id) on delete restrict,
  visibility   public.visibility_state not null default 'private',
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint dreams_completed_matches_status check ((status = 'achieved') = (completed_at is not null))
);

create table public.places (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid not null references public.couple_worlds (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  description text,
  latitude    numeric(9,6) check (latitude between -90 and 90),
  longitude   numeric(9,6) check (longitude between -180 and 180),
  visit_date  date,
  created_by  uuid not null references public.profiles (id) on delete restrict,
  visibility  public.visibility_state not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint places_coordinates_together check ((latitude is null) = (longitude is null))
);

create table public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  world_id   uuid not null references public.couple_worlds (id) on delete restrict,
  title      text,
  body       text not null,
  entry_date date not null default current_date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  visibility public.visibility_state not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.songs (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references public.couple_worlds (id) on delete restrict,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  artist       text,
  external_url text check (external_url is null or external_url ~* '^https?://'),
  description  text,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ───────────── comments / reactions (polymorphic: content_id has no FK) ─────────────
create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references public.couple_worlds (id) on delete restrict,
  author_id    uuid not null references public.profiles (id) on delete restrict,
  content_type public.content_kind not null,
  content_id   uuid not null,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.reactions (
  id            uuid primary key default gen_random_uuid(),
  world_id      uuid not null references public.couple_worlds (id) on delete restrict,
  user_id       uuid not null references public.profiles (id) on delete restrict,
  content_type  public.content_kind not null,
  content_id    uuid not null,
  reaction_type public.reaction_kind not null,
  created_at    timestamptz not null default now(),
  constraint reactions_one_per_user_target unique (user_id, content_type, content_id, reaction_type)
);

-- ───────────── notifications / activity (no generation logic yet) ─────────────
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  world_id       uuid not null references public.couple_worlds (id) on delete restrict,
  recipient_id   uuid not null references public.profiles (id) on delete restrict,
  type           public.notification_kind not null,
  title          text not null,
  body           text,
  reference_type public.content_kind,
  reference_id   uuid,
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  constraint notifications_reference_pair check ((reference_type is null) = (reference_id is null))
);

create table public.activity_events (
  id             uuid primary key default gen_random_uuid(),
  world_id       uuid not null references public.couple_worlds (id) on delete restrict,
  actor_id       uuid not null references public.profiles (id) on delete restrict,
  event_type     public.activity_kind not null,
  reference_type public.content_kind not null,
  reference_id   uuid not null,
  created_at     timestamptz not null default now()
);

-- ───────────── updated_at triggers ─────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','couple_worlds','memories','letters','surprises','milestones',
    'timeline_events','dreams','places','journal_entries','songs','comments'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- ───────────── Indexes (query-pattern driven) ─────────────
create index memories_world_date_idx   on public.memories (world_id, memory_date desc) where deleted_at is null;
create index memories_creator_idx      on public.memories (created_by);
create index memory_media_memory_idx   on public.memory_media (memory_id) where deleted_at is null;
create index letters_world_created_idx on public.letters (world_id, created_at desc) where deleted_at is null;
create index letters_creator_idx       on public.letters (created_by);
create index surprises_world_unlock_idx on public.surprises (world_id, unlock_at) where deleted_at is null;
create index surprises_recipient_idx   on public.surprises (recipient_id);
create index milestones_world_date_idx on public.milestones (world_id, milestone_date);
create index timeline_world_date_idx   on public.timeline_events (world_id, event_date desc);
create index dreams_world_status_idx   on public.dreams (world_id, status);
create index places_world_idx          on public.places (world_id);
create index journal_world_date_idx    on public.journal_entries (world_id, entry_date desc) where deleted_at is null;
create index journal_creator_idx       on public.journal_entries (created_by);
create index songs_world_idx           on public.songs (world_id);
create index comments_target_idx       on public.comments (content_type, content_id) where deleted_at is null;
create index reactions_target_idx      on public.reactions (content_type, content_id);
create index notifications_unread_idx  on public.notifications (recipient_id, created_at desc) where read_at is null;
create index activity_world_created_idx on public.activity_events (world_id, created_at desc);

-- ───────────── Row Level Security: deny-all until Phase 3 policies ─────────────
alter table public.profiles         enable row level security;
alter table public.couple_worlds    enable row level security;
alter table public.memories         enable row level security;
alter table public.memory_media     enable row level security;
alter table public.letters          enable row level security;
alter table public.surprises        enable row level security;
alter table public.milestones       enable row level security;
alter table public.timeline_events  enable row level security;
alter table public.dreams           enable row level security;
alter table public.places           enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.songs            enable row level security;
alter table public.comments         enable row level security;
alter table public.reactions        enable row level security;
alter table public.notifications    enable row level security;
alter table public.activity_events  enable row level security;
