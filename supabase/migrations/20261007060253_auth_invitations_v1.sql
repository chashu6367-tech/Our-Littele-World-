-- Phase 4: invitation/consent onboarding. Applied to the project as version 20261007060253.
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

-- Caller's own CONFIRMED email, or null. SECURITY DEFINER only because auth.users is not readable by API roles;
-- it returns nothing but the caller's own address.
create function private.verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;
revoke all on function private.verified_email() from public, anon;
grant execute on function private.verified_email() to authenticated;

create table public.invitations (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  invitee_email text not null,
  status       public.invitation_status not null default 'pending',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  constraint invitations_email_format check (invitee_email = lower(btrim(invitee_email))
    and char_length(invitee_email) <= 254 and invitee_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint invitations_expiry_after_creation check (expires_at > created_at),
  constraint invitations_accepted_matches_status check ((status = 'accepted') = (accepted_at is not null))
);
create unique index invitations_one_pending_per_pair on public.invitations (inviter_id, invitee_email) where status = 'pending';
create index invitations_invitee_idx on public.invitations (invitee_email) where status = 'pending';
create index invitations_inviter_idx on public.invitations (inviter_id);
alter table public.invitations enable row level security;

revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
grant insert (invitee_email) on public.invitations to authenticated;   -- inviter_id/status/expiry are server-defaulted
grant update (status) on public.invitations to authenticated;          -- inviter may only revoke (policy)

create policy invitations_select on public.invitations for select to authenticated using (
  inviter_id = (select auth.uid()) or invitee_email = (select private.verified_email()));
create policy invitations_insert on public.invitations for insert to authenticated with check (
  inviter_id = (select auth.uid()) and status = 'pending'
  and (select private.verified_email()) is not null
  and invitee_email <> (select private.verified_email())                       -- no self-invitation
  and not exists (select 1 from public.couple_worlds w
                  where (select auth.uid()) in (w.partner_one_id, w.partner_two_id)));  -- paired people cannot invite
create policy invitations_revoke on public.invitations for update to authenticated
  using (inviter_id = (select auth.uid()) and status = 'pending')
  with check (inviter_id = (select auth.uid()) and status = 'revoked');

-- The invitee may see the inviter's profile while a valid invitation is pending (consent needs a name to consent to).
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (select 1 from public.couple_worlds w
             where (w.partner_one_id = (select auth.uid()) and w.partner_two_id = profiles.id)
                or (w.partner_two_id = (select auth.uid()) and w.partner_one_id = profiles.id))
  or exists (select 1 from public.invitations i
             where i.inviter_id = profiles.id and i.status = 'pending' and i.expires_at > now()
               and i.invitee_email = (select private.verified_email())));

-- Atomic consent + pairing. Accepts ONLY an invitation id; every identity is derived from auth.uid() and the invitation row.
create function public.accept_invitation(p_invitation_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  inv public.invitations;
  my_email text;
  v_world uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform pg_advisory_xact_lock(hashtext('couple_worlds_membership'));     -- serialise concurrent pairings
  select lower(u.email) into my_email from auth.users u where u.id = uid and u.email_confirmed_at is not null;
  select * into inv from public.invitations where id = p_invitation_id for update;
  -- identical error for "does not exist" and "not yours": no existence oracle
  if not found or my_email is null or inv.invitee_email <> my_email then
    raise exception 'invitation_unavailable' using errcode = 'P0001';
  end if;
  if inv.status = 'accepted' then raise exception 'invitation_accepted' using errcode = 'P0001'; end if;
  if inv.status = 'revoked'  then raise exception 'invitation_revoked'  using errcode = 'P0001'; end if;
  if inv.status = 'expired' or inv.expires_at <= now() then raise exception 'invitation_expired' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'profile_required' using errcode = 'P0001'; end if;
  if exists (select 1 from public.couple_worlds w where uid in (w.partner_one_id, w.partner_two_id)) then
    raise exception 'already_paired' using errcode = 'P0001'; end if;
  if exists (select 1 from public.couple_worlds w where inv.inviter_id in (w.partner_one_id, w.partner_two_id)) then
    raise exception 'inviter_paired' using errcode = 'P0001'; end if;
  insert into public.couple_worlds (partner_one_id, partner_two_id) values (inv.inviter_id, uid) returning id into v_world;
  update public.invitations set status = 'accepted', accepted_at = now() where id = inv.id;
  return v_world;
end $$;
revoke all on function public.accept_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
