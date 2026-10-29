create table public.journal_entries (
 id text primary key check (id ~ '^[a-zA-Z0-9-]{1,80}$'),
 owner_id uuid not null default auth.uid() references auth.users(id),
 content jsonb not null,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint journal_content_valid check (
 jsonb_typeof(content)='object' and octet_length(content::text)<=24000
 and content->>'id'=id
 and jsonb_typeof(content->'title')='string' and length(btrim(content->>'title')) between 1 and 120
 and jsonb_typeof(content->'body')='string' and length(btrim(content->>'body')) between 1 and 4000
 and jsonb_typeof(content->'opponent')='string' and length(btrim(content->>'opponent')) between 1 and 80
 and content->>'matchDate' ~ '^\d{4}-\d{2}-\d{2}$'
 and content->>'image' in ('','om-chelsea.jpg','blue-on-the-road.jpg')
 )
);
create index journal_entries_owner_idx on public.journal_entries(owner_id,updated_at desc);
create table public.journal_publications (
 id text primary key references public.journal_entries(id),
 owner_id uuid not null references auth.users(id),
 content jsonb not null,
 source_version integer not null,
 published_at timestamptz not null default now()
);
create index journal_publications_owner_idx on public.journal_publications(owner_id);
create index journal_publications_date_idx on public.journal_publications(published_at desc);
alter table public.journal_entries enable row level security;
alter table public.journal_publications enable row level security;
revoke all on public.journal_entries, public.journal_publications from anon,authenticated;
grant select,insert,update on public.journal_entries to authenticated;
grant select on public.journal_publications to anon,authenticated;
grant insert,update,delete on public.journal_publications to authenticated;
grant all on public.journal_entries,public.journal_publications to service_role;
create policy journal_owner_read on public.journal_entries for select to authenticated using(owner_id=(select auth.uid()) and (select public.is_chat_owner()));
create policy journal_owner_insert on public.journal_entries for insert to authenticated with check(owner_id=(select auth.uid()) and (select public.is_chat_owner()));
create policy journal_owner_update on public.journal_entries for update to authenticated using(owner_id=(select auth.uid()) and (select public.is_chat_owner())) with check(owner_id=(select auth.uid()) and (select public.is_chat_owner()));
create policy journal_published_read on public.journal_publications for select to anon,authenticated using(true);
create policy journal_publish_insert on public.journal_publications for insert to authenticated with check(owner_id=(select auth.uid()) and (select public.is_chat_owner()));
create policy journal_publish_update on public.journal_publications for update to authenticated using(owner_id=(select auth.uid()) and (select public.is_chat_owner())) with check(owner_id=(select auth.uid()) and (select public.is_chat_owner()));
create policy journal_unpublish on public.journal_publications for delete to authenticated using(owner_id=(select auth.uid()) and (select public.is_chat_owner()));
create function om_chat_private.journal_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then NEW.version=1;NEW.created_at=now();
 else
 if NEW.owner_id<>OLD.owner_id or NEW.id<>OLD.id then raise exception 'Journal identity is immutable' using errcode='42501';end if;
 NEW.version=OLD.version+1;NEW.created_at=OLD.created_at;
 end if;
 NEW.updated_at=now();return NEW;
end;$$;
create trigger journal_version before insert or update on public.journal_entries for each row execute function om_chat_private.journal_version();
create function om_chat_private.journal_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry public.journal_entries;
begin
 select * into entry from public.journal_entries where id=NEW.id and owner_id=auth.uid();
 if not found or not public.is_chat_owner() then raise exception 'Only the confirmed owner can publish saved entries' using errcode='42501';end if;
 NEW.owner_id=entry.owner_id;NEW.content=entry.content;NEW.source_version=entry.version;NEW.published_at=now();return NEW;
end;$$;
create trigger journal_snapshot before insert or update on public.journal_publications for each row execute function om_chat_private.journal_snapshot();
comment on table public.journal_entries is 'Private drafts. Published snapshots are stored separately; editing a draft never auto-publishes.';
comment on table public.journal_publications is 'Explicit owner-published snapshots only. Trigger copies saved private content; no client-supplied publication body is trusted.';
