-- Polymorphic-reference test for soft-deleted Places (private.can_see 'place' branch).
-- Run AFTER migration 20261011033538_places_v1 is applied. Everything runs in a sub-transaction that is always rolled back.
-- Replace the three uuids; expect every value true. Notifications/activity have no client INSERT grant, so they are seeded as the
-- privileged role (as the future server-side generator would) and READ back as the partners.
create temp table _r(j text);
do $t$
declare
  w uuid := '<WORLD_ID>'; p1 uuid := '<PARTNER_ONE_ID>'; p2 uuid := '<PARTNER_TWO_ID>'; o uuid := gen_random_uuid();
  s uuid; pr uuid; m uuid; mp uuid; d uuid; n int; b boolean; res jsonb := '[]'::jsonb;
begin
  begin
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    insert into public.places(world_id,name,is_visited,visibility,created_by) values (w,'T-shared',true,'shared',p1) returning id into s;
    insert into public.places(world_id,name,visibility,created_by) values (w,'T-private','private',p1) returning id into pr;
    insert into public.memories(world_id,title,visibility,created_by) values (w,'T-mem','shared',p1) returning id into m;
    insert into public.memories(world_id,title,visibility,created_by) values (w,'T-mem-private','private',p1) returning id into mp;
    insert into public.dreams(world_id,title,visibility,created_by) values (w,'T-dream','shared',p1) returning id into d;
    insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p1,'place',s,'T-c1');
    -- ===== 1. live shared place behaves as before =====
    b := private.can_see('place',s,w); res := res || jsonb_build_object('P1a creator can_see live place', b);
    insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p1,'place',s,'love');
    insert into public.timeline_events(world_id,title,event_date,event_type,reference_id,created_by,visibility) values (w,'T-tl','2026-01-01','place',s,p1,'shared');
    res := res || jsonb_build_object('P1e creator can react + add timeline event on live place', true);
    reset role;
    insert into public.notifications(world_id,recipient_id,type,title,reference_type,reference_id) values (w,p2,'new_content','T-n2','place',s),(w,p1,'new_content','T-n1','place',s);
    insert into public.activity_events(world_id,actor_id,event_type,reference_type,reference_id) values (w,p1,'created','place',s);
    perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    b := private.can_see('place',s,w); res := res || jsonb_build_object('P1b partner can_see live shared place', b);
    insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'place',s,'T-c2');
    insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p2,'place',s,'smile');
    res := res || jsonb_build_object('P1c partner can comment + react on live place', true);
    select count(*) into n from public.comments where content_id=s; res := res || jsonb_build_object('P1g partner sees both comments', n=2);
    select count(*) into n from public.reactions where content_id=s; res := res || jsonb_build_object('P1h partner sees both reactions', n=2);
    select count(*) into n from public.notifications where reference_id=s; res := res || jsonb_build_object('P1i partner sees own notification', n=1);
    select count(*) into n from public.activity_events where reference_id=s; res := res || jsonb_build_object('P1j partner sees activity', n=1);
    select count(*) into n from public.timeline_events where reference_id=s; res := res || jsonb_build_object('P1k partner sees shared timeline event', n=1);
    -- ===== 2. soft-delete the place =====
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.places set deleted_at=now() where id=s; get diagnostics n=row_count; res := res || jsonb_build_object('P2-0 creator soft-deletes place', n=1);
    b := private.can_see('place',s,w); res := res || jsonb_build_object('P2a creator: can_see deleted place is false', not b);
    b := private.timeline_ref_visible('place',s,w); res := res || jsonb_build_object('P2a2 creator: timeline_ref_visible false', not b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p1,'place',s,'x'); res := res || jsonb_build_object('P2e creator cannot comment on deleted place', false); exception when others then res := res || jsonb_build_object('P2e creator cannot comment on deleted place', true); end;
    begin insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p1,'place',s,'hug'); res := res || jsonb_build_object('P2f creator cannot react to deleted place', false); exception when others then res := res || jsonb_build_object('P2f creator cannot react to deleted place', true); end;
    begin insert into public.timeline_events(world_id,title,event_date,event_type,reference_id,created_by,visibility) values (w,'x','2026-01-01','place',s,p1,'shared'); res := res || jsonb_build_object('P2g creator cannot add timeline event for deleted place', false); exception when others then res := res || jsonb_build_object('P2g creator cannot add timeline event for deleted place', true); end;
    select count(*) into n from public.places where id=s; res := res || jsonb_build_object('P2n creator can still read the deleted place record', n=1);
    select count(*) into n from public.comments where content_id=s; res := res || jsonb_build_object('P2o creator: comments on deleted place hidden', n=0);
    select count(*) into n from public.reactions where content_id=s; res := res || jsonb_build_object('P2o2 creator: reactions on deleted place hidden', n=0);
    select count(*) into n from public.notifications where reference_id=s; res := res || jsonb_build_object('P2p creator: notification for deleted place hidden', n=0);
    select count(*) into n from public.activity_events where reference_id=s; res := res || jsonb_build_object('P2q creator: activity for deleted place hidden', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    b := private.can_see('place',s,w); res := res || jsonb_build_object('P2b partner: can_see deleted place is false', not b);
    b := private.timeline_ref_visible('place',s,w); res := res || jsonb_build_object('P2b2 partner: timeline_ref_visible false', not b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'place',s,'x'); res := res || jsonb_build_object('P2c partner cannot comment on deleted place', false); exception when others then res := res || jsonb_build_object('P2c partner cannot comment on deleted place', true); end;
    begin insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p2,'place',s,'hug'); res := res || jsonb_build_object('P2d partner cannot react to deleted place', false); exception when others then res := res || jsonb_build_object('P2d partner cannot react to deleted place', true); end;
    begin insert into public.timeline_events(world_id,title,event_date,event_type,reference_id,created_by,visibility) values (w,'x','2026-01-01','place',s,p2,'shared'); res := res || jsonb_build_object('P2h partner cannot add timeline event for deleted place', false); exception when others then res := res || jsonb_build_object('P2h partner cannot add timeline event for deleted place', true); end;
    select count(*) into n from public.comments where content_id=s; res := res || jsonb_build_object('P2i partner: existing comments hidden', n=0);
    select count(*) into n from public.reactions where content_id=s; res := res || jsonb_build_object('P2j partner: existing reactions hidden', n=0);
    select count(*) into n from public.notifications where reference_id=s; res := res || jsonb_build_object('P2k partner: existing notification hidden', n=0);
    select count(*) into n from public.activity_events where reference_id=s; res := res || jsonb_build_object('P2l partner: existing activity hidden', n=0);
    select count(*) into n from public.timeline_events where reference_id=s; res := res || jsonb_build_object('P2m partner: creator''s shared timeline event hidden', n=0);
    select count(*) into n from public.places where id=s; res := res || jsonb_build_object('P2s partner cannot read the deleted place record', n=0);
    select count(*) into n from public.places where name ilike '%T-shared%'; res := res || jsonb_build_object('P2t partner search finds nothing', n=0);
    -- ===== 3. every other kind is unchanged =====
    b := private.can_see('memory',m,w); res := res || jsonb_build_object('P3a partner can_see shared memory', b);
    b := private.can_see('memory',mp,w); res := res || jsonb_build_object('P3b partner cannot can_see private memory', not b);
    b := private.can_see('place',pr,w); res := res || jsonb_build_object('P3c partner cannot can_see private live place', not b);
    b := private.can_see('dream',d,w); res := res || jsonb_build_object('P3d partner can_see shared dream', b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'place',pr,'x'); res := res || jsonb_build_object('P3h partner cannot comment on private place', false); exception when others then res := res || jsonb_build_object('P3h partner cannot comment on private place', true); end;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.dreams set deleted_at=now() where id=d; update public.memories set deleted_at=now() where id=m;
    b := private.can_see('dream',d,w); res := res || jsonb_build_object('P3e dream branch unchanged: creator still can_see own deleted dream', b);
    b := private.can_see('memory',m,w); res := res || jsonb_build_object('P3g memory branch unchanged: creator still can_see own deleted memory', b);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    b := private.can_see('dream',d,w); res := res || jsonb_build_object('P3f partner cannot can_see deleted dream (RLS)', not b);
    -- ===== 4. restore: nothing was destroyed =====
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.places set deleted_at=null where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    b := private.can_see('place',s,w); res := res || jsonb_build_object('P4a restored place is visible to partner again', b);
    select count(*) into n from public.comments where content_id=s; res := res || jsonb_build_object('P4b existing comments reappear after restore', n=2);
    -- ===== 5. outsiders =====
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',o,'role','authenticated')::text, true); set local role authenticated;
    b := private.can_see('place',s,w); res := res || jsonb_build_object('P6 unrelated user cannot can_see the place', not b);
    reset role; set local role anon;
    begin perform private.can_see('place',s,w); res := res || jsonb_build_object('P5 anon cannot call can_see', false); exception when insufficient_privilege then res := res || jsonb_build_object('P5 anon cannot call can_see', true); end;
    reset role; raise exception 'RESULT:%', res::text;
  exception when raise_exception then insert into _r values (sqlerrm); end;
end $t$;
select j, (select count(*) from public.places where name like 'T-%') as places_left, (select count(*) from public.comments where body like 'T-%') as comments_left,
  (select count(*) from public.notifications where title like 'T-%') as notifications_left, (select count(*) from public.activity_events) as activity_left,
  (select count(*) from public.timeline_events where title like 'T-%') as timeline_left from _r;
