-- Run as a transaction: all test users, grants/claims, entries and publications roll back.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('b148280f-cf3c-41fc-a9ca-707b70a515ce','journal-qa-owner@example.invalid',now()),
 ('f86a1144-790d-41e7-b395-b033e4971685','journal-qa-outsider@example.invalid',now());
insert into public.site_admins(approved_email) values ('journal-qa-owner@example.invalid');
select set_config('request.jwt.claims','{"sub":"b148280f-cf3c-41fc-a9ca-707b70a515ce","role":"authenticated"}',true);
set local role authenticated;
select public.claim_chat_owner();
insert into public.journal_entries(id,content) values ('journal-qa-entry',jsonb_build_object('id','journal-qa-entry','title','TEST DRAFT','matchDate','2025-07-13','opponent','PSG','score','3–0','mood','ภูมิใจ','motm','','body','Private draft A','moment','','image','','createdAt','2026-10-29T10:00:00Z','updatedAt','2026-10-29T10:00:00Z'));
insert into public.journal_publications(id) values('journal-qa-entry');
update public.journal_entries set content=jsonb_set(content,'{body}','"Private draft B"') where id='journal-qa-entry';
do $$ begin
 if (select content->>'body' from public.journal_publications where id='journal-qa-entry')<>'Private draft A' then raise exception 'draft edit leaked into publication';end if;
 if (select version from public.journal_entries where id='journal-qa-entry')<>2 then raise exception 'version did not increment';end if;
 begin
  insert into public.journal_entries(id,content) select batch.id,entry.content||jsonb_build_object('id',batch.id) from public.journal_entries entry cross join (values ('journal-qa-atomic-new'),('journal-qa-entry')) as batch(id) where entry.id='journal-qa-entry';
  raise exception 'duplicate batch unexpectedly accepted';
 exception when unique_violation then null;end;
 if exists(select 1 from public.journal_entries where id='journal-qa-atomic-new') then raise exception 'failed batch was partially saved';end if;
end;$$;
reset role;
select set_config('request.jwt.claims','{"sub":"f86a1144-790d-41e7-b395-b033e4971685","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.journal_entries where id='journal-qa-entry') then raise exception 'outsider read private draft';end if;
 begin
 insert into public.journal_publications(id) values('journal-qa-entry') on conflict(id) do update set content='{}';
 raise exception 'outsider published';
 exception when insufficient_privilege then null;end;
 begin perform public.claim_chat_owner();raise exception 'outsider claimed owner';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 begin perform content from public.journal_entries;raise exception 'anon read drafts';exception when insufficient_privilege then null;end;
 if (select content->>'body' from public.journal_publications where id='journal-qa-entry')<>'Private draft A' then raise exception 'public snapshot mismatch';end if;
 begin delete from public.journal_publications where id='journal-qa-entry';raise exception 'anon deleted publication';exception when insufficient_privilege then null;end;
end;$$;
reset role;
select set_config('request.jwt.claims','{"sub":"b148280f-cf3c-41fc-a9ca-707b70a515ce","role":"authenticated"}',true);
set local role authenticated;
update public.journal_publications set content='{"untrusted":"ignored"}' where id='journal-qa-entry';
do $$ begin if (select content->>'body' from public.journal_publications where id='journal-qa-entry')<>'Private draft B' then raise exception 'publish did not use saved draft';end if;end;$$;
delete from public.journal_publications where id='journal-qa-entry';
do $$ begin if not exists(select 1 from public.journal_entries where id='journal-qa-entry') then raise exception 'unpublish deleted private draft';end if;end;$$;
reset role;
select json_build_object('result','PASS','checks',array['owner claim','private draft isolation','public snapshot isolation','version increment','outsider blocked','anon writes blocked','server snapshot source','unpublish preserves draft','atomic import rollback']);
rollback;
