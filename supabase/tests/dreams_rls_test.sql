-- Dreams RLS test. Read-only in effect: every scenario runs in a sub-transaction that is always rolled back.
-- Replace the three uuids with the world and both partner ids, run in the SQL editor / execute_sql. Expect every value true.
create temp table _r(j text);
do $$
declare
  w uuid := '<WORLD_ID>'; p1 uuid := '<PARTNER_ONE_ID>'; p2 uuid := '<PARTNER_TWO_ID>';
  out uuid := gen_random_uuid(); s uuid; pr uuid; s2 uuid; n int; res jsonb := '[]'::jsonb;
begin
  begin
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    insert into public.dreams(world_id,title,status,visibility,created_by) values (w,'T-shared','in_progress','shared',p1) returning id into s;
    insert into public.dreams(world_id,title,status,visibility,created_by) values (w,'T-private','planned','private',p1) returning id into pr;
    res := res || jsonb_build_object('A create shared+private as p1', true);
    begin update public.dreams set status='achieved' where id=s; res := res || jsonb_build_object('B1 achieved without completed_at rejected', false);
    exception when check_violation then res := res || jsonb_build_object('B1 achieved without completed_at rejected', true); end;
    update public.dreams set status='achieved', completed_at=now() where id=s; get diagnostics n = row_count; res := res || jsonb_build_object('B2 creator can complete', n=1);
    update public.dreams set status='in_progress', completed_at=null where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.dreams where id in (s,pr); res := res || jsonb_build_object('C1 partner sees only the shared one', n=1);
    select count(*) into n from public.dreams where id=pr; res := res || jsonb_build_object('C2 partner cannot read private by id', n=0);
    select count(*) into n from public.dreams where title ilike '%private%'; res := res || jsonb_build_object('C3 partner search finds no private title', n=0);
    select count(*) into n from public.dreams; res := res || jsonb_build_object('C4 partner count excludes private', n=1);
    update public.dreams set title='hacked' where id in (s,pr); get diagnostics n = row_count; res := res || jsonb_build_object('D1 partner cannot edit', n=0);
    update public.dreams set deleted_at=now() where id=s; get diagnostics n = row_count; res := res || jsonb_build_object('D2 partner cannot soft-delete', n=0);
    begin delete from public.dreams where id=s; res := res || jsonb_build_object('D3 no client DELETE', false);
    exception when insufficient_privilege then res := res || jsonb_build_object('D3 no client DELETE', true); end;
    begin insert into public.dreams(world_id,title,visibility,created_by) values (w,'spoof','shared',p1); res := res || jsonb_build_object('E1 spoofed created_by rejected', false);
    exception when others then res := res || jsonb_build_object('E1 spoofed created_by rejected', true); end;
    begin insert into public.dreams(world_id,title,visibility,created_by) values (gen_random_uuid(),'spoof','shared',p2); res := res || jsonb_build_object('E2 spoofed world_id rejected', false);
    exception when others then res := res || jsonb_build_object('E2 spoofed world_id rejected', true); end;
    insert into public.dreams(world_id,title,visibility,created_by) values (w,'T-p2','shared',p2) returning id into s2;
    res := res || jsonb_build_object('E3 partner can create (equal capability)', true);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    begin update public.dreams set created_by=p2 where id=s; res := res || jsonb_build_object('F1 created_by immutable', false);
    exception when insufficient_privilege then res := res || jsonb_build_object('F1 created_by immutable', true); end;
    begin update public.dreams set world_id=gen_random_uuid() where id=s; res := res || jsonb_build_object('F2 world_id immutable', false);
    exception when insufficient_privilege then res := res || jsonb_build_object('F2 world_id immutable', true); end;
    update public.dreams set visibility='private' where id=s2; get diagnostics n = row_count; res := res || jsonb_build_object('G0 p1 cannot change p2 dream', n=0);
    update public.dreams set visibility='private' where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.dreams where id=s; res := res || jsonb_build_object('G1 shared->private hides from partner', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.dreams set visibility='shared' where id=s;
    update public.dreams set deleted_at=now() where id=s; get diagnostics n = row_count; res := res || jsonb_build_object('H1 creator can soft-delete', n=1);
    select count(*) into n from public.dreams where id=s; res := res || jsonb_build_object('H2 creator still reads own deleted row', n=1);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.dreams where id=s; res := res || jsonb_build_object('H3 partner cannot read deleted shared dream', n=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',out,'role','authenticated')::text, true); set local role authenticated;
    select count(*) into n from public.dreams; res := res || jsonb_build_object('I1 unrelated user sees nothing', n=0);
    begin insert into public.dreams(world_id,title,visibility,created_by) values (w,'x','shared',out); res := res || jsonb_build_object('I2 unrelated user cannot insert', false);
    exception when others then res := res || jsonb_build_object('I2 unrelated user cannot insert', true); end;
    reset role; set local role anon;
    begin perform 1 from public.dreams; res := res || jsonb_build_object('J1 anon has no access', false);
    exception when insufficient_privilege then res := res || jsonb_build_object('J1 anon has no access', true); end;
    reset role; raise exception 'RESULT:%', res::text;
  exception when raise_exception then insert into _r values (sqlerrm); end;
end $$;
select j, (select count(*) from public.dreams) as dreams_left_after from _r;
