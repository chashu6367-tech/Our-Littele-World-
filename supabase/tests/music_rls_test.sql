-- Music (songs) RLS + validation test. Run AFTER migration 20261011120000_music_v1 is applied.
-- Every scenario runs in a sub-transaction that is always rolled back. Replace the three uuids; expect every value true.
-- Notifications/activity have no client INSERT grant, so they are seeded as the privileged role and READ back as the partners.
create temp table _r(j text);
do $t$
declare
  w uuid := '<WORLD_ID>'; p1 uuid := '<PARTNER_ONE_ID>'; p2 uuid := '<PARTNER_TWO_ID>'; o uuid := gen_random_uuid();
  s uuid; pr uuid; s2 uuid; s3 uuid; n int; b boolean; v text; res jsonb := '[]'::jsonb;
begin
  begin
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    insert into public.songs(world_id,title,artist,external_url,description,visibility,created_by) values (w,'T-shared','Artist X','https://open.spotify.com/track/abc123?si=xyz#t','shared note','shared',p1) returning id into s;
    insert into public.songs(world_id,title,artist,external_url,description,visibility,created_by) values (w,'T-private','Secret Artist','https://music.example.com/secret','private note','private',p1) returning id into pr;
    res := res || jsonb_build_object('A1 create shared + private songs as p1', true);
    -- URL / field validation (database CHECKs)
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','http://open.spotify.com/x',p1); res := res || jsonb_build_object('A2 plain http rejected', false); exception when check_violation then res := res || jsonb_build_object('A2 plain http rejected', true); end;
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','https://user:pw@evil.example.com/x',p1); res := res || jsonb_build_object('A3 credentials in URL rejected', false); exception when check_violation then res := res || jsonb_build_object('A3 credentials in URL rejected', true); end;
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','javascript:alert(1)',p1); res := res || jsonb_build_object('A4 javascript: URL rejected', false); exception when check_violation then res := res || jsonb_build_object('A4 javascript: URL rejected', true); end;
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','https://example.com/a b',p1); res := res || jsonb_build_object('A5 whitespace in URL rejected', false); exception when check_violation then res := res || jsonb_build_object('A5 whitespace in URL rejected', true); end;
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','https://example.com/'||repeat('a',2000),p1); res := res || jsonb_build_object('A6 URL over 2000 chars rejected', false); exception when check_violation then res := res || jsonb_build_object('A6 URL over 2000 chars rejected', true); end;
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','https://example.com/"x',p1); res := res || jsonb_build_object('A7 quote character in URL rejected', false); exception when check_violation then res := res || jsonb_build_object('A7 quote character in URL rejected', true); end;
    begin insert into public.songs(world_id,title,external_url,created_by) values (w,'T-x','https://',p1); res := res || jsonb_build_object('A7b scheme-only URL rejected', false); exception when check_violation then res := res || jsonb_build_object('A7b scheme-only URL rejected', true); end;
    insert into public.songs(world_id,title,external_url,visibility,created_by) values (w,'T-host-only','https://example.com','private',p1);
    insert into public.songs(world_id,title,external_url,visibility,created_by) values (w,'T-port','https://example.com:8443/p?q=1&r=2#frag','private',p1);
    res := res || jsonb_build_object('A8 ordinary https links (host only, port/query/fragment) accepted', true);
    begin insert into public.songs(world_id,title,created_by) values (w,'   ',p1); res := res || jsonb_build_object('A9 blank title rejected', false); exception when check_violation then res := res || jsonb_build_object('A9 blank title rejected', true); end;
    begin insert into public.songs(world_id,title,artist,created_by) values (w,'T-x',repeat('a',201),p1); res := res || jsonb_build_object('A10 artist over 200 chars rejected', false); exception when check_violation then res := res || jsonb_build_object('A10 artist over 200 chars rejected', true); end;
    begin insert into public.songs(world_id,title,description,created_by) values (w,'T-x',repeat('a',2001),p1); res := res || jsonb_build_object('A11 notes over 2000 chars rejected', false); exception when check_violation then res := res || jsonb_build_object('A11 notes over 2000 chars rejected', true); end;
    insert into public.songs(world_id,title,created_by) values (w,'T-default',p1) returning visibility::text into v;
    res := res || jsonb_build_object('A12 visibility defaults to private', v='private');
    -- privileged seeding of notifications/activity that point at both songs
    reset role;
    insert into public.notifications(world_id,recipient_id,type,title,reference_type,reference_id) values (w,p2,'new_content','T-n-priv','song',pr),(w,p2,'new_content','T-n-shared','song',s);
    insert into public.activity_events(world_id,actor_id,event_type,reference_type,reference_id) values (w,p1,'created','song',pr),(w,p1,'created','song',s);
    -- partner view
    perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.songs where id in (s,pr); res := res || jsonb_build_object('C1 partner sees only the shared song', n=1);
    select count(*) into n from public.songs where id=pr; res := res || jsonb_build_object('C2 partner cannot read private song by id', n=0);
    select count(*) into n from public.songs where artist ilike '%secret%' or title ilike '%private%' or description ilike '%private note%'; res := res || jsonb_build_object('C3 partner search finds no private title/artist/notes', n=0);
    select count(*) into n from public.songs; res := res || jsonb_build_object('C4 partner total count excludes every private song', n=1);
    select count(*) into n from public.songs where id=pr and external_url is not null; res := res || jsonb_build_object('C5 partner cannot read private URL', n=0);
    select count(*) into n from public.songs where id=s and external_url like 'https://open.spotify.com/%'; res := res || jsonb_build_object('C6 partner can read the shared song link', n=1);
    select count(*) into n from public.notifications where reference_id=pr; res := res || jsonb_build_object('C7 notification about private song hidden', n=0);
    select count(*) into n from public.notifications where reference_id=s; res := res || jsonb_build_object('C8 notification about shared song visible', n=1);
    select count(*) into n from public.activity_events where reference_id=pr; res := res || jsonb_build_object('C9 activity about private song hidden', n=0);
    select count(*) into n from public.activity_events where reference_id=s; res := res || jsonb_build_object('C10 activity about shared song visible', n=1);
    -- partner cannot modify
    update public.songs set title='hacked' where id in (s,pr); get diagnostics n=row_count; res := res || jsonb_build_object('D1 partner cannot edit p1 songs', n=0);
    update public.songs set deleted_at=now() where id=s; get diagnostics n=row_count; res := res || jsonb_build_object('D2 partner cannot soft-delete p1 song', n=0);
    begin delete from public.songs where id=s; res := res || jsonb_build_object('D3 no client DELETE', false); exception when insufficient_privilege then res := res || jsonb_build_object('D3 no client DELETE', true); end;
    -- spoofing + equal capability
    begin insert into public.songs(world_id,title,visibility,created_by) values (w,'T-spoof','shared',p1); res := res || jsonb_build_object('E1 spoofed created_by rejected', false); exception when others then res := res || jsonb_build_object('E1 spoofed created_by rejected', true); end;
    begin insert into public.songs(world_id,title,visibility,created_by) values (gen_random_uuid(),'T-spoof','shared',p2); res := res || jsonb_build_object('E2 spoofed world_id rejected', false); exception when others then res := res || jsonb_build_object('E2 spoofed world_id rejected', true); end;
    begin insert into public.songs(world_id,title,visibility,created_by,deleted_at) values (w,'T-spoof','shared',p2,now()); res := res || jsonb_build_object('E2b cannot insert pre-deleted row', false); exception when insufficient_privilege then res := res || jsonb_build_object('E2b cannot insert pre-deleted row', true); end;
    insert into public.songs(world_id,title,visibility,created_by) values (w,'T-p2','shared',p2) returning id into s2;
    insert into public.songs(world_id,title,visibility,created_by) values (w,'T-p2-private','private',p2) returning id into s3;
    res := res || jsonb_build_object('E3 partner can create shared + private (equal capability)', true);
    -- p1: immutable ownership, cannot touch p2's rows
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    begin update public.songs set created_by=p2 where id=s; res := res || jsonb_build_object('F1 created_by immutable', false); exception when insufficient_privilege then res := res || jsonb_build_object('F1 created_by immutable', true); end;
    begin update public.songs set world_id=gen_random_uuid() where id=s; res := res || jsonb_build_object('F2 world_id immutable', false); exception when insufficient_privilege then res := res || jsonb_build_object('F2 world_id immutable', true); end;
    update public.songs set visibility='private' where id=s2; get diagnostics n=row_count; res := res || jsonb_build_object('F3 p1 cannot change p2 song visibility', n=0);
    select count(*) into n from public.songs where id=s3; res := res || jsonb_build_object('F4 p1 cannot read p2 private song', n=0);
    -- shared -> private -> shared
    update public.songs set visibility='private' where id=s; get diagnostics n=row_count; res := res || jsonb_build_object('G0 creator can switch to private', n=1);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.songs where id=s; res := res || jsonb_build_object('G1 shared->private hides it from partner', n=0);
    select count(*) into n from public.notifications where reference_id=s; res := res || jsonb_build_object('G2 its notification is hidden too', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.songs set visibility='shared' where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.songs where id=s; res := res || jsonb_build_object('G3 private->shared shows it again', n=1);
    -- comments gate on can_see
    insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'song',s,'T-c');
    res := res || jsonb_build_object('H0 partner can comment on a live shared song', true);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'song',pr,'x'); res := res || jsonb_build_object('H0b partner cannot comment on a private song', false); exception when others then res := res || jsonb_build_object('H0b partner cannot comment on a private song', true); end;
    b := private.can_see('song',pr,w); res := res || jsonb_build_object('H0c can_see(private song) false for partner', not b);
    -- soft delete
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.songs set deleted_at=now() where id=s; get diagnostics n=row_count; res := res || jsonb_build_object('H1 creator can soft-delete', n=1);
    select count(*) into n from public.songs where id=s; res := res || jsonb_build_object('H2 creator still reads own deleted row (convention)', n=1);
    b := private.can_see('song',s,w); res := res || jsonb_build_object('H3 can_see(deleted song) false for creator', not b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p1,'song',s,'x'); res := res || jsonb_build_object('H4 creator cannot comment on deleted song', false); exception when others then res := res || jsonb_build_object('H4 creator cannot comment on deleted song', true); end;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.songs where id=s; res := res || jsonb_build_object('H5 partner cannot read deleted shared song', n=0);
    select count(*) into n from public.songs; res := res || jsonb_build_object('H5b partner sees exactly their own 2 songs (p1 deleted/private ones excluded)', n=2);
    b := private.can_see('song',s,w); res := res || jsonb_build_object('H6 can_see(deleted song) false for partner', not b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'song',s,'x'); res := res || jsonb_build_object('H7 partner cannot comment on deleted song', false); exception when others then res := res || jsonb_build_object('H7 partner cannot comment on deleted song', true); end;
    select count(*) into n from public.comments where content_id=s; res := res || jsonb_build_object('H8 existing comment on deleted song hidden', n=0);
    select count(*) into n from public.notifications where reference_id=s; res := res || jsonb_build_object('H9 notification for deleted song hidden', n=0);
    select count(*) into n from public.activity_events where reference_id=s; res := res || jsonb_build_object('H10 activity for deleted song hidden', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.songs set deleted_at=null where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.songs where id=s; res := res || jsonb_build_object('H11 restored song visible again', n=1);
    select count(*) into n from public.comments where content_id=s; res := res || jsonb_build_object('H12 existing comment reappears after restore', n=1);
    -- outsiders
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',o,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.songs; res := res || jsonb_build_object('I1 unrelated user sees no songs', n=0);
    begin insert into public.songs(world_id,title,visibility,created_by) values (w,'T-x','shared',o); res := res || jsonb_build_object('I2 unrelated user cannot insert', false); exception when others then res := res || jsonb_build_object('I2 unrelated user cannot insert', true); end;
    b := private.can_see('song',s,w); res := res || jsonb_build_object('I3 can_see false for unrelated user', not b);
    reset role; set local role anon;
    begin perform 1 from public.songs; res := res || jsonb_build_object('J1 anon cannot read songs', false); exception when insufficient_privilege then res := res || jsonb_build_object('J1 anon cannot read songs', true); end;
    reset role; raise exception 'RESULT:%', res::text;
  exception when raise_exception then insert into _r values (sqlerrm); end;
end $t$;
select j, (select count(*) from public.songs where title like 'T-%') as songs_left, (select count(*) from public.comments where body like 'T-%') as comments_left,
  (select count(*) from public.notifications where title like 'T-%') as notifications_left, (select count(*) from public.activity_events) as activity_left from _r;
