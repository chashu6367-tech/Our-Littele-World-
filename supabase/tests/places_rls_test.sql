-- Places RLS + Storage test. Run AFTER migration 20261011033538_places_v1 is applied. Every scenario rolls back; no rows persist.
-- Replace the three uuids, run in the SQL editor / execute_sql. Expect every value true. (Direct SQL DELETE on storage.objects is blocked
-- by Supabase, so the delete policy is checked through private.owns_place_object, the function the policy uses.)
create temp table _r(j text);
do $t$
declare
  w uuid := '<WORLD_ID>'; p1 uuid := '<PARTNER_ONE_ID>'; p2 uuid := '<PARTNER_TWO_ID>';
  o uuid := gen_random_uuid(); s uuid; pr uuid; s2 uuid; n int; b boolean; res jsonb := '[]'::jsonb; path_s text; path_p text;
begin
  begin
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    insert into public.places(world_id,name,location_text,is_visited,visit_date,visibility,created_by) values (w,'T-shared','Mysuru',true,'2026-01-05','shared',p1) returning id into s;
    insert into public.places(world_id,name,is_visited,visibility,created_by) values (w,'T-private',false,'private',p1) returning id into pr;
    res := res || jsonb_build_object('A1 create visited+shared and planned+private', true);
    begin insert into public.places(world_id,name,is_visited,visit_date,visibility,created_by) values (w,'bad',false,'2027-01-01','shared',p1); res := res || jsonb_build_object('A2 planned place cannot carry a visit date', false);
    exception when check_violation then res := res || jsonb_build_object('A2 planned place cannot carry a visit date', true); end;
    update public.places set is_visited=true, visit_date=null where id=pr; get diagnostics n=row_count; res := res || jsonb_build_object('A3 visited with no date allowed; creator can edit', n=1);
    update public.places set is_visited=false where id=pr;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.places where id in (s,pr); res := res || jsonb_build_object('C1 partner sees only the shared place', n=1);
    select count(*) into n from public.places where id=pr; res := res || jsonb_build_object('C2 partner cannot read private by id', n=0);
    select count(*) into n from public.places where name ilike '%private%'; res := res || jsonb_build_object('C3 partner search finds no private name', n=0);
    select count(*) into n from public.places; res := res || jsonb_build_object('C4 partner count excludes private', n=1);
    update public.places set name='hacked' where id in (s,pr); get diagnostics n=row_count; res := res || jsonb_build_object('D1 partner cannot edit', n=0);
    update public.places set deleted_at=now() where id=s; get diagnostics n=row_count; res := res || jsonb_build_object('D2 partner cannot soft-delete', n=0);
    begin delete from public.places where id=s; res := res || jsonb_build_object('D3 no client DELETE', false); exception when insufficient_privilege then res := res || jsonb_build_object('D3 no client DELETE', true); end;
    begin insert into public.places(world_id,name,visibility,created_by) values (w,'spoof','shared',p1); res := res || jsonb_build_object('E1 spoofed created_by rejected', false); exception when others then res := res || jsonb_build_object('E1 spoofed created_by rejected', true); end;
    begin insert into public.places(world_id,name,visibility,created_by) values (gen_random_uuid(),'spoof','shared',p2); res := res || jsonb_build_object('E2 spoofed world_id rejected', false); exception when others then res := res || jsonb_build_object('E2 spoofed world_id rejected', true); end;
    insert into public.places(world_id,name,visibility,created_by) values (w,'T-p2','shared',p2) returning id into s2;
    res := res || jsonb_build_object('E3 partner can create (equal capability)', true);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    begin update public.places set created_by=p2 where id=s; res := res || jsonb_build_object('F1 created_by immutable', false); exception when insufficient_privilege then res := res || jsonb_build_object('F1 created_by immutable', true); end;
    begin update public.places set world_id=gen_random_uuid() where id=s; res := res || jsonb_build_object('F2 world_id immutable', false); exception when insufficient_privilege then res := res || jsonb_build_object('F2 world_id immutable', true); end;
    update public.places set visibility='private' where id=s2; get diagnostics n=row_count; res := res || jsonb_build_object('G0 p1 cannot change p2 place', n=0);
    update public.places set visibility='private' where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.places where id=s; res := res || jsonb_build_object('G1 shared->private hides from partner', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.places set visibility='shared' where id=s;
    path_s := w||'/'||s||'/'||gen_random_uuid()||'.jpg'; path_p := w||'/'||pr||'/'||gen_random_uuid()||'.png';
    insert into storage.objects(bucket_id,name,owner) values ('place-media',path_s,p1); insert into storage.objects(bucket_id,name,owner) values ('place-media',path_p,p1);
    res := res || jsonb_build_object('S1 creator uploads covers to own place folders', true);
    update public.places set cover_path=path_s where id=s; get diagnostics n=row_count; update public.places set cover_path=path_p where id=pr;
    res := res || jsonb_build_object('S2 creator sets cover_path', n=1);
    begin update public.places set cover_path = w||'/'||gen_random_uuid()||'/'||gen_random_uuid()||'.jpg' where id=s; res := res || jsonb_build_object('S3 cover_path must point into own place folder', false); exception when check_violation then res := res || jsonb_build_object('S3 cover_path must point into own place folder', true); end;
    begin insert into storage.objects(bucket_id,name,owner) values ('place-media', w||'/'||s||'/'||gen_random_uuid()||'.exe', p1); res := res || jsonb_build_object('S4 bad extension rejected', false); exception when others then res := res || jsonb_build_object('S4 bad extension rejected', true); end;
    b := private.owns_place_object(path_s); res := res || jsonb_build_object('S9 creator passes delete-policy check', b);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from storage.objects where bucket_id='place-media' and name=path_s; res := res || jsonb_build_object('S5 partner can read shared place cover', n=1);
    select count(*) into n from storage.objects where bucket_id='place-media' and name=path_p; res := res || jsonb_build_object('S6 partner cannot read private place cover', n=0);
    select count(*) into n from storage.objects where bucket_id='place-media'; res := res || jsonb_build_object('S6b partner object count excludes private', n=1);
    begin insert into storage.objects(bucket_id,name,owner) values ('place-media', w||'/'||s||'/'||gen_random_uuid()||'.jpg', p2); res := res || jsonb_build_object('S7 partner cannot upload into p1 place folder', false); exception when others then res := res || jsonb_build_object('S7 partner cannot upload into p1 place folder', true); end;
    b := private.owns_place_object(path_s) or private.owns_place_object(path_p); res := res || jsonb_build_object('S8 partner fails delete-policy check on p1 covers', not b);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.places set deleted_at=now() where id=s; get diagnostics n=row_count; res := res || jsonb_build_object('H1 creator can soft-delete', n=1);
    select count(*) into n from public.places where id=s; res := res || jsonb_build_object('H2 creator still reads own deleted row (convention)', n=1);
    begin insert into storage.objects(bucket_id,name,owner) values ('place-media', w||'/'||s||'/'||gen_random_uuid()||'.jpg', p1); res := res || jsonb_build_object('H4 no upload into a deleted place', false); exception when others then res := res || jsonb_build_object('H4 no upload into a deleted place', true); end;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.places where id=s; res := res || jsonb_build_object('H3 partner cannot read deleted shared place', n=0);
    select count(*) into n from storage.objects where bucket_id='place-media' and name=path_s; res := res || jsonb_build_object('H5 partner cannot read deleted place cover', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',o,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.places; res := res || jsonb_build_object('I1 unrelated user sees no places', n=0);
    select count(*) into n from storage.objects where bucket_id='place-media'; res := res || jsonb_build_object('I2 unrelated user sees no place media', n=0);
    begin insert into public.places(world_id,name,visibility,created_by) values (w,'x','shared',o); res := res || jsonb_build_object('I3 unrelated user cannot insert', false); exception when others then res := res || jsonb_build_object('I3 unrelated user cannot insert', true); end;
    reset role; set local role anon;
    begin perform 1 from public.places; res := res || jsonb_build_object('J1 anon cannot read places', false); exception when insufficient_privilege then res := res || jsonb_build_object('J1 anon cannot read places', true); end;
    begin select count(*) into n from storage.objects where bucket_id='place-media'; res := res || jsonb_build_object('J2 anon sees no place media', n=0); exception when insufficient_privilege then res := res || jsonb_build_object('J2 anon sees no place media', true); end;
    reset role; raise exception 'RESULT:%', res::text;
  exception when raise_exception then insert into _r values (sqlerrm); end;
end $t$;
select j, (select count(*) from public.places) as places_left_after from _r;
