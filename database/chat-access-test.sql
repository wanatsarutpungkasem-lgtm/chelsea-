-- Integration test: every fixture and write is rolled back.
begin;
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  o uuid := gen_random_uuid();
  owner_email text := 'chat-test-' || o::text || '@example.invalid';
begin
  perform set_config('om_test.a', a::text, true);
  perform set_config('om_test.b', b::text, true);
  perform set_config('om_test.owner', o::text, true);
  insert into auth.users(id, aud, role, email, email_confirmed_at, is_anonymous, raw_app_meta_data, raw_user_meta_data)
  values
    (a, 'authenticated', 'authenticated', 'chat-test-' || a::text || '@example.invalid', now(), false, '{}', '{}'),
    (b, 'authenticated', 'authenticated', 'chat-test-' || b::text || '@example.invalid', now(), false, '{}', '{}'),
    (o, 'authenticated', 'authenticated', owner_email, null, false, '{}', '{}');
  insert into public.site_admins(approved_email) values(owner_email);
  insert into public.bot_knowledge(slug,question,answer,is_published)
  values ('test-unpublished-' || a::text, 'draft', 'private draft', false);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('om_test.a'), true);
do $$
declare s uuid; n integer;
begin
  insert into public.chat_sessions(display_name) values('Test visitor A') returning id into s;
  perform set_config('om_test.session_a', s::text, true);
  insert into public.chat_messages(session_id,body) values(s,'Message A');
  if not exists(select 1 from public.chat_messages where session_id=s
    and sender_role='visitor' and sender_id=auth.uid()) then
    raise exception 'Visitor identity not assigned';
  end if;
  begin
    insert into public.chat_messages(session_id,body,sender_role) values(s,'spoof','owner');
    raise exception 'Sender role spoof was accepted' using errcode='P0999';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.chat_messages(session_id,body) values(s,'   ');
    raise exception 'Empty body accepted' using errcode='P0999';
  exception when check_violation then null; end;
  begin
    perform public.claim_chat_owner();
    raise exception 'Unapproved account became owner' using errcode='P0999';
  exception when insufficient_privilege then null; end;
  update public.chat_sessions set status='closed' where id=s;
  get diagnostics n = row_count;
  if n<>0 then raise exception 'Visitor could change admin session state'; end if;
  begin
    perform approved_email from public.site_admins;
    raise exception 'Approval email exposed' using errcode='P0999';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('om_test.b'), true);
do $$
declare s uuid; a uuid := current_setting('om_test.session_a')::uuid;
begin
  if exists(select 1 from public.chat_sessions where id=a)
    or exists(select 1 from public.chat_messages where session_id=a)
    or exists(select 1 from public.chat_inbox where id=a) then
    raise exception 'Visitor B can read visitor A data';
  end if;
  begin
    insert into public.chat_messages(session_id,body) values(a,'Cross-user write');
    raise exception 'Cross-user send accepted' using errcode='P0999';
  exception when insufficient_privilege then null; end;
  insert into public.chat_sessions(display_name) values('Test visitor B') returning id into s;
  perform set_config('om_test.session_b',s::text,true);
  insert into public.chat_messages(session_id,body) values(s,'Message B');
end;
$$;

set local role anon;
do $$
begin
  begin
    perform id from public.chat_messages;
    raise exception 'Unauthenticated read accepted' using errcode='P0999';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.bot_knowledge where not is_published) then
    raise exception 'Unpublished knowledge exposed';
  end if;
  if not exists(select 1 from public.bot_knowledge where slug='about-om') then
    raise exception 'Published answers unavailable';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('om_test.owner'), true);
do $$
begin
  begin
    perform public.claim_chat_owner();
    raise exception 'Unconfirmed owner accepted' using errcode='P0999';
  exception when insufficient_privilege then null; end;
end;
$$;
set local role postgres;
update auth.users set email_confirmed_at=now() where id=current_setting('om_test.owner')::uuid;
set local role authenticated;
select public.claim_chat_owner();
do $$
declare a uuid := current_setting('om_test.session_a')::uuid;
begin
  if not public.is_chat_owner() then
    raise exception 'Verified owner claim failed';
  end if;
  if (select count(*) from public.chat_sessions
    where id in (a,current_setting('om_test.session_b')::uuid))<>2 then
    raise exception 'Owner cannot see both sessions';
  end if;
  if (select unread_count from public.chat_inbox where id=a)<>1 then
    raise exception 'Unread count mismatch';
  end if;
  insert into public.chat_messages(session_id,body) values(a,'Owner reply');
  if not exists(select 1 from public.chat_messages where session_id=a and sender_role='owner') then
    raise exception 'Owner sender not assigned';
  end if;
  update public.chat_sessions set last_admin_read_at=clock_timestamp(),status='closed' where id=a;
  if (select unread_count from public.chat_inbox where id=a)<>0 then
    raise exception 'Read marker not applied';
  end if;
  insert into public.bot_knowledge(slug,question,answer,is_published)
    values('test-owner-' || auth.uid()::text, 'Owner question', 'Owner answer', false);
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('om_test.a'), true);
do $$
declare a uuid := current_setting('om_test.session_a')::uuid;
begin
  if not exists(select 1 from public.chat_messages where session_id=a and sender_role='owner') then
    raise exception 'Visitor cannot read owner reply';
  end if;
  begin
    insert into public.chat_messages(session_id,body) values(a,'Closed chat write');
    raise exception 'Closed chat accepted visitor write' using errcode='P0999';
  exception when insufficient_privilege then null; end;
  begin
    update public.chat_messages set body='changed' where session_id=a;
    raise exception 'Immutable message changed' using errcode='P0999';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.site_admins(approved_email,user_id) values('attacker@example.invalid',auth.uid());
    raise exception 'Visitor granted owner access' using errcode='P0999';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('om_test.b'), true);
do $$
declare i integer; b uuid := current_setting('om_test.session_b')::uuid;
begin
  for i in 1..19 loop
    insert into public.chat_messages(session_id,body) values(b,'Rate limit test ' || i);
  end loop;
  begin
    insert into public.chat_messages(session_id,body) values(b,'Over limit');
    raise exception 'Rate limit not enforced' using errcode='P0999';
  exception when sqlstate 'P0001' then null; end;
end;
$$;

set local role service_role;
insert into public.chat_messages(session_id,sender_role,body)
  values(current_setting('om_test.session_a')::uuid,'bot','Trusted backend bot reply');
select 'PASS' as result,
  'Visitor isolation, sender protection, owner verification, unread counts, immutable messages, rate limiting, bot backend access' as tested;
rollback;
