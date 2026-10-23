-- Letters RLS + validation test. Run ONLY AFTER migration 20261020075753_letters_v1 has been applied. Never run it before.
--
-- HOW TO RUN (a failed assertion must fail the run):
--     psql "$DIRECT_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/letters_rls_test.sql ; echo "exit code: $?"      # exit code 0 = every assertion passed
--   or paste the whole file into the Supabase SQL editor and run it once: any failure is a red error, a pass ends with a PASSED row.
-- Replace the three uuids below (world id, partner one id, partner two id). An un-replaced '<...>' placeholder fails immediately (invalid uuid).
--
-- WHAT IT DOES: all scenarios run inside one sub-transaction that ALWAYS ends in a rollback (a private error code T0001 forces it), so the
-- database is left unchanged. Notifications/activity have no client INSERT grant, so they are seeded as the privileged role and READ back as
-- the partners. Every row it creates carries a per-run tag (title/body/comment/notification text), and the post-rollback residue checks look
-- only at rows with that tag or that point at the test letters, never at unrelated existing data.
--
-- HOW IT FAILS:
--   * a false assertion  -> after the rollback, ERROR 'LETTERS RLS TEST FAILED: n of m assertions failed: <labels>' (SQLSTATE T0002)
--   * a wrong error type -> every negative check handles ONE specific SQLSTATE (42501 insufficient_privilege for RLS / missing grants,
--                           23514 check_violation + the exact constraint name for data rules). Any other error is NOT caught: it aborts
--                           the whole script with its real message, so an unexpected failure can never count as a pass.
--   * a wrong number of assertions (a check silently skipped) also fails (T0002); a wrong setup (uuids not this world's partners) fails (T0003).

do $t$
declare
  w   uuid := '<WORLD_ID>';
  p1  uuid := '<PARTNER_ONE_ID>';
  p2  uuid := '<PARTNER_TWO_ID>';
  o   uuid := gen_random_uuid();
  tag text := 'LTEST-' || replace(gen_random_uuid()::text, '-', '');
  expected_checks constant int := 70;
  s uuid; pr uuid; s2 uuid; s3 uuid; ids uuid[] := '{}';
  n int; b boolean; v text; fp text; fp2 text; cn text;
  res jsonb := '{}'::jsonb;
  total int; failed int; failed_list text;
begin
  if not exists (select 1 from public.couple_worlds c where c.id = w and p1 <> p2 and array[p1, p2] @> array[c.partner_one_id, c.partner_two_id]) then
    raise exception using errcode = 'T0003', message = 'Test setup is wrong: the three uuids must be this world and its two partners.';
  end if;

  begin
    -- K: policies, grants and can_see are exactly what they should be (fingerprints taken from the live database on 2026-10-19, before letters_v1).
    -- The grant fingerprint uses pg_catalog (has_column_privilege), so it does not depend on which role runs the test; whitespace is normalised for can_see so CRLF/LF checkouts compare equal.
    reset role;
    select md5(string_agg(policyname||cmd||coalesce(qual,'')||coalesce(with_check,''),'|' order by policyname)) into fp from pg_policies where schemaname='public' and tablename='letters';
    res := res || jsonb_build_object('K1 letters policies unchanged', fp = '0407aaec4c8d7dc826eb9c1fd83cb094');
    select md5(string_agg(r||':'||p||':'||a.attname,'|' order by r,p,a.attname)) into fp from pg_attribute a cross join (values ('anon'),('authenticated')) rr(r) cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) pp(p) where a.attrelid='public.letters'::regclass and a.attnum>0 and not a.attisdropped and has_column_privilege(r,'public.letters',a.attname,p);
    select string_agg(r||':'||p, ',' order by r,p) into fp2 from (values ('anon'),('authenticated')) rr(r) cross join (values ('DELETE'),('TRUNCATE'),('TRIGGER')) pp(p) where has_table_privilege(r,'public.letters',p);
    res := res || jsonb_build_object('K2 letters column grants unchanged (anon + authenticated; no table-level DELETE/TRUNCATE/TRIGGER)', fp = '834dff94e8ef0e9d8fa5f45545a72bde' and fp2 is null);
    res := res || jsonb_build_object('K3 body constraint + live index present', exists (select 1 from pg_constraint where conrelid='public.letters'::regclass and conname='letters_body_check') and exists (select 1 from pg_indexes where schemaname='public' and tablename='letters' and indexname='letters_world_live_idx'));
    select md5(regexp_replace(prosrc, '\s+', ' ', 'g')) into fp from pg_proc where oid='private.can_see(public.content_kind,uuid,uuid)'::regprocedure;
    res := res || jsonb_build_object('K4 can_see = music_v1 body + only the letter deleted_at filter (whitespace-normalised; all other branches unchanged)', fp = '60a2a8bdd9ac72e4b00770640fc9eddb');
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-shared','shared body','shared',p1) returning id into s;
    insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-private','private secret body','private',p1) returning id into pr;
    res := res || jsonb_build_object('A1 create shared + private letters as p1', true);
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x','',p1); res := res || jsonb_build_object('A2 empty body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A2 empty body rejected', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x',E'  \n\t \r\n ',p1); res := res || jsonb_build_object('A3 whitespace-only body (spaces, tabs, newlines, CR, mixed) rejected by the intended rule', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A3 whitespace-only body (spaces, tabs, newlines, CR, mixed) rejected by the intended rule', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x','     ',p1); res := res || jsonb_build_object('A3a spaces-only body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A3a spaces-only body rejected', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x',E'\t\t',p1); res := res || jsonb_build_object('A3b tab-only body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A3b tab-only body rejected', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x',E'\n\n',p1); res := res || jsonb_build_object('A3c newline-only body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A3c newline-only body rejected', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x',E'\r\r\n',p1); res := res || jsonb_build_object('A3d carriage-return-only body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A3d carriage-return-only body rejected', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x',E'\f\x0b',p1); res := res || jsonb_build_object('A3e form-feed / vertical-tab-only body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A3e form-feed / vertical-tab-only body rejected', cn = 'letters_body_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,tag||'-x',repeat('a',20001),p1); res := res || jsonb_build_object('A4 body over 20000 chars rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A4 body over 20000 chars rejected', cn = 'letters_body_check'); end;
    insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-max',repeat('a',20000),'private',p1);
    res := res || jsonb_build_object('A5 body of exactly 20000 chars accepted', true);
    insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-pad',E' \n real words \t\r\n ','private',p1);
    res := res || jsonb_build_object('A5b body with real text inside surrounding whitespace accepted', true);
    begin insert into public.letters(world_id,title,body,created_by) values (w,'   ','x',p1); res := res || jsonb_build_object('A6 blank title rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A6 blank title rejected', cn = 'letters_title_check'); end;
    begin insert into public.letters(world_id,title,body,created_by) values (w,repeat('a',201),'x',p1); res := res || jsonb_build_object('A7 title over 200 chars rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A7 title over 200 chars rejected', cn = 'letters_title_check'); end;
    begin update public.letters set body=E' \t\n' where id=s; res := res || jsonb_build_object('A8 update to whitespace-only body rejected', false); exception when check_violation then get stacked diagnostics cn = constraint_name; res := res || jsonb_build_object('A8 update to whitespace-only body rejected', cn = 'letters_body_check'); end;
    insert into public.letters(world_id,title,body,created_by) values (w,tag||'-default','x',p1) returning visibility::text into v;
    res := res || jsonb_build_object('A9 visibility defaults to private', v='private');
    reset role;
    insert into public.notifications(world_id,recipient_id,type,title,reference_type,reference_id) values (w,p2,'new_content',tag||'-n-priv','letter',pr),(w,p2,'new_content',tag||'-n-shared','letter',s);
    insert into public.activity_events(world_id,actor_id,event_type,reference_type,reference_id) values (w,p1,'created','letter',pr),(w,p1,'created','letter',s);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    res := res || jsonb_build_object('C1 partner sees only the shared letter', (select count(*) from public.letters where id in (s,pr))=1);
    res := res || jsonb_build_object('C2 partner cannot read private letter by id', (select count(*) from public.letters where id=pr)=0);
    res := res || jsonb_build_object('C3 partner search finds no private title/body', (select count(*) from public.letters where title like tag||'%' and (title ilike '%private%' or body ilike '%secret%'))=0);
    res := res || jsonb_build_object('C4 partner count of this test letters excludes every private letter', (select count(*) from public.letters where title like tag||'%')=1);
    res := res || jsonb_build_object('C5 notification about private letter hidden', (select count(*) from public.notifications where reference_id=pr)=0);
    res := res || jsonb_build_object('C6 notification about shared letter visible', (select count(*) from public.notifications where reference_id=s)=1);
    res := res || jsonb_build_object('C7 activity about private letter hidden', (select count(*) from public.activity_events where reference_id=pr)=0);
    res := res || jsonb_build_object('C8 activity about shared letter visible', (select count(*) from public.activity_events where reference_id=s)=1);
    update public.letters set title=tag||'-hacked' where id in (s,pr); get diagnostics n=row_count;
    res := res || jsonb_build_object('D1 partner cannot edit p1 letters', n=0);
    update public.letters set deleted_at=now() where id=s; get diagnostics n=row_count;
    res := res || jsonb_build_object('D2 partner cannot soft-delete p1 letter', n=0);
    begin delete from public.letters where id=s; res := res || jsonb_build_object('D3 no client DELETE', false); exception when insufficient_privilege then res := res || jsonb_build_object('D3 no client DELETE', true); end;
    begin insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-spoof','x','shared',p1); res := res || jsonb_build_object('E1 spoofed created_by rejected', false); exception when insufficient_privilege then res := res || jsonb_build_object('E1 spoofed created_by rejected', true); end;
    begin insert into public.letters(world_id,title,body,visibility,created_by) values (gen_random_uuid(),tag||'-spoof','x','shared',p2); res := res || jsonb_build_object('E2 spoofed world_id rejected', false); exception when insufficient_privilege then res := res || jsonb_build_object('E2 spoofed world_id rejected', true); end;
    begin insert into public.letters(world_id,title,body,visibility,created_by,deleted_at) values (w,tag||'-spoof','x','shared',p2,now()); res := res || jsonb_build_object('E2b cannot insert pre-deleted row', false); exception when insufficient_privilege then res := res || jsonb_build_object('E2b cannot insert pre-deleted row', true); end;
    insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-p2','from p2','shared',p2) returning id into s2;
    insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-p2-private','p2 secret','private',p2) returning id into s3;
    res := res || jsonb_build_object('E3 partner can create shared + private (equal capability)', true);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    begin update public.letters set created_by=p2 where id=s; res := res || jsonb_build_object('F1 created_by immutable', false); exception when insufficient_privilege then res := res || jsonb_build_object('F1 created_by immutable', true); end;
    begin update public.letters set world_id=gen_random_uuid() where id=s; res := res || jsonb_build_object('F2 world_id immutable', false); exception when insufficient_privilege then res := res || jsonb_build_object('F2 world_id immutable', true); end;
    update public.letters set visibility='private' where id=s2; get diagnostics n=row_count;
    res := res || jsonb_build_object('F3 p1 cannot change p2 letter visibility', n=0);
    res := res || jsonb_build_object('F4 p1 cannot read p2 private letter', (select count(*) from public.letters where id=s3)=0);
    update public.letters set visibility='private' where id=s; get diagnostics n=row_count;
    res := res || jsonb_build_object('G0 creator can switch to private', n=1);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    res := res || jsonb_build_object('G1 shared->private hides it from partner', (select count(*) from public.letters where id=s)=0);
    res := res || jsonb_build_object('G2 its notification is hidden too', (select count(*) from public.notifications where reference_id=s)=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.letters set visibility='shared' where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    res := res || jsonb_build_object('G3 private->shared shows it again', (select count(*) from public.letters where id=s)=1);
    insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'letter',s,tag||'-c');
    insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p2,'letter',s,'love');
    res := res || jsonb_build_object('H0 partner can comment + react on a live shared letter', true);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'letter',pr,tag||'-x'); res := res || jsonb_build_object('H0b partner cannot comment on a private letter', false); exception when insufficient_privilege then res := res || jsonb_build_object('H0b partner cannot comment on a private letter', true); end;
    b := private.can_see('letter',pr,w);
    res := res || jsonb_build_object('H0c can_see(private letter) false for partner', not b);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.letters set deleted_at=now() where id=s; get diagnostics n=row_count;
    res := res || jsonb_build_object('H1 creator can soft-delete', n=1);
    res := res || jsonb_build_object('H2 creator still reads own deleted row (convention)', (select count(*) from public.letters where id=s)=1);
    b := private.can_see('letter',s,w);
    res := res || jsonb_build_object('H3 can_see(deleted letter) false for creator', not b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p1,'letter',s,tag||'-x'); res := res || jsonb_build_object('H4 creator cannot comment on deleted letter', false); exception when insufficient_privilege then res := res || jsonb_build_object('H4 creator cannot comment on deleted letter', true); end;
    begin insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p1,'letter',s,'love'); res := res || jsonb_build_object('H4b creator cannot react to deleted letter', false); exception when insufficient_privilege then res := res || jsonb_build_object('H4b creator cannot react to deleted letter', true); end;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    res := res || jsonb_build_object('H5 partner cannot read deleted shared letter', (select count(*) from public.letters where id=s)=0);
    res := res || jsonb_build_object('H5b partner sees exactly their own 2 test letters (p1 deleted/private ones excluded)', (select count(*) from public.letters where title like tag||'%')=2);
    b := private.can_see('letter',s,w);
    res := res || jsonb_build_object('H6 can_see(deleted letter) false for partner', not b);
    begin insert into public.comments(world_id,author_id,content_type,content_id,body) values (w,p2,'letter',s,tag||'-x'); res := res || jsonb_build_object('H7 partner cannot comment on deleted letter', false); exception when insufficient_privilege then res := res || jsonb_build_object('H7 partner cannot comment on deleted letter', true); end;
    begin insert into public.reactions(world_id,user_id,content_type,content_id,reaction_type) values (w,p2,'letter',s,'hug'); res := res || jsonb_build_object('H7b partner cannot react to deleted letter', false); exception when insufficient_privilege then res := res || jsonb_build_object('H7b partner cannot react to deleted letter', true); end;
    res := res || jsonb_build_object('H8 existing comment on deleted letter hidden', (select count(*) from public.comments where content_id=s)=0);
    res := res || jsonb_build_object('H8b existing reaction on deleted letter hidden', (select count(*) from public.reactions where content_id=s)=0);
    res := res || jsonb_build_object('H9 notification for deleted letter hidden', (select count(*) from public.notifications where reference_id=s)=0);
    res := res || jsonb_build_object('H10 activity for deleted letter hidden', (select count(*) from public.activity_events where reference_id=s)=0);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p1,'role','authenticated')::text, true); set local role authenticated;
    update public.letters set deleted_at=null where id=s;
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',p2,'role','authenticated')::text, true); set local role authenticated;
    res := res || jsonb_build_object('H11 restored letter visible again', (select count(*) from public.letters where id=s)=1);
    res := res || jsonb_build_object('H12 existing comment reappears after restore', (select count(*) from public.comments where content_id=s)=1);
    reset role; perform set_config('request.jwt.claims', jsonb_build_object('sub',o,'role','authenticated')::text, true); set local role authenticated;
    res := res || jsonb_build_object('I1 unrelated user sees no letters at all', (select count(*) from public.letters)=0);
    begin insert into public.letters(world_id,title,body,visibility,created_by) values (w,tag||'-x','x','shared',o); res := res || jsonb_build_object('I2 unrelated user cannot insert', false); exception when insufficient_privilege then res := res || jsonb_build_object('I2 unrelated user cannot insert', true); end;
    b := private.can_see('letter',s,w);
    res := res || jsonb_build_object('I3 can_see false for unrelated user', not b);
    reset role; set local role anon;
    begin perform 1 from public.letters; res := res || jsonb_build_object('J1 anon cannot read letters', false); exception when insufficient_privilege then res := res || jsonb_build_object('J1 anon cannot read letters', true); end;
    reset role;
    ids := array[s,pr,s2,s3];
    -- always roll everything back; the variables (res, ids, tag) survive the rollback, the database changes do not
    raise exception using errcode = 'T0001', message = 'rollback';
  exception when sqlstate 'T0001' then null;
  end;

  -- Z: residue. The database is back to its starting state, and we look ONLY at rows made by this run (tag / the test letters' ids).
  reset role;
  res := res || jsonb_build_object('Z1 no test letters remain',        (select count(*) from public.letters where title like tag || '%') = 0);
  res := res || jsonb_build_object('Z2 no test comments remain',       (select count(*) from public.comments where body like tag || '%' or (content_type = 'letter' and content_id = any(ids))) = 0);
  res := res || jsonb_build_object('Z3 no test reactions remain',      (select count(*) from public.reactions where content_type = 'letter' and content_id = any(ids)) = 0);
  res := res || jsonb_build_object('Z4 no test notifications remain',  (select count(*) from public.notifications where title like tag || '%' or (reference_type = 'letter' and reference_id = any(ids))) = 0);
  res := res || jsonb_build_object('Z5 no test activity remains',      (select count(*) from public.activity_events where reference_type = 'letter' and reference_id = any(ids)) = 0);

  select count(*), count(*) filter (where value <> 'true'::jsonb), string_agg(key, ' | ' order by key) filter (where value <> 'true'::jsonb)
    into total, failed, failed_list from jsonb_each(res);
  if failed > 0 or total <> expected_checks then
    raise exception using errcode = 'T0002',
      message = format('LETTERS RLS TEST FAILED: %s of %s assertions failed (expected %s assertions): %s', failed, total, expected_checks, coalesce(failed_list, 'none; the assertion count is wrong')),
      hint = 'Nothing was left behind: every change was rolled back.';
  end if;
  raise notice 'LETTERS RLS TEST PASSED: % of % assertions, all changes rolled back.', total, total;
end $t$;

select 'LETTERS RLS TEST PASSED' as result;
