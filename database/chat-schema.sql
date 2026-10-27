-- Schema for Supabase project unjtfvxnxdgqlupzkgoc.
-- Apply once through a named Supabase migration. Owner approval is separate data.
create schema om_chat_private;
revoke all on schema om_chat_private from public, anon, authenticated;
grant usage on schema om_chat_private to authenticated, service_role;

create table public.site_admins (
  id uuid primary key default gen_random_uuid(),
  approved_email text not null unique,
  user_id uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approved_email_normalized check (
    approved_email = lower(btrim(approved_email)) and
    char_length(approved_email) between 3 and 254
  )
);
alter table public.site_admins enable row level security;
revoke all on public.site_admins from public, anon, authenticated;
grant select (user_id) on public.site_admins to authenticated;
grant all on public.site_admins to service_role;
create policy admin_can_check_own_membership on public.site_admins
  for select to authenticated using (user_id = (select auth.uid()));

create function om_chat_private.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.site_admins where user_id = (select auth.uid())
  );
$$;
revoke all on function om_chat_private.is_admin() from public, anon;
grant execute on function om_chat_private.is_admin() to authenticated, service_role;

-- This is the only privileged function. It claims a preapproved email, never
-- grants access based on user-editable metadata or the first person to sign in.
create function om_chat_private.claim_owner()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  verified_email text;
  approved_id uuid;
begin
  if actor is null then
    raise exception 'Sign in before claiming owner access' using errcode = '42501';
  end if;
  select lower(u.email) into verified_email
    from auth.users u
    where u.id = actor and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous, false);
  if verified_email is null then
    raise exception 'A confirmed email account is required' using errcode = '42501';
  end if;
  update public.site_admins
    set user_id = actor, claimed_at = coalesce(claimed_at, now())
    where approved_email = verified_email
      and (user_id is null or user_id = actor)
    returning id into approved_id;
  if approved_id is null then
    raise exception 'This account is not the approved site owner' using errcode = '42501';
  end if;
  return true;
end;
$$;
revoke all on function om_chat_private.claim_owner() from public, anon;
grant execute on function om_chat_private.claim_owner() to authenticated;

create function public.claim_chat_owner()
returns boolean language sql volatile security invoker set search_path = ''
as $$ select om_chat_private.claim_owner(); $$;
revoke all on function public.claim_chat_owner() from public, anon;
grant execute on function public.claim_chat_owner() to authenticated;

create function public.is_chat_owner()
returns boolean language sql stable security invoker set search_path = ''
as $$ select om_chat_private.is_admin(); $$;
revoke all on function public.is_chat_owner() from public, anon;
grant execute on function public.is_chat_owner() to authenticated, service_role;

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default 'แฟนบอล',
  status text not null default 'open' check (status in ('open', 'closed')),
  last_admin_read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint display_name_length check (char_length(btrim(display_name)) between 1 and 80)
);
create index chat_sessions_visitor_created_idx on public.chat_sessions(visitor_id, created_at desc);
alter table public.chat_sessions enable row level security;
revoke all on public.chat_sessions from public, anon, authenticated;
grant select on public.chat_sessions to authenticated;
grant insert (display_name) on public.chat_sessions to authenticated;
grant update (status, last_admin_read_at) on public.chat_sessions to authenticated;
grant all on public.chat_sessions to service_role;
create policy session_read on public.chat_sessions for select to authenticated
  using (visitor_id = (select auth.uid()) or (select om_chat_private.is_admin()));
create policy session_create on public.chat_sessions for insert to authenticated
  with check (visitor_id = (select auth.uid()));
create policy session_owner_update on public.chat_sessions for update to authenticated
  using ((select om_chat_private.is_admin()))
  with check ((select om_chat_private.is_admin()));

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'visitor' check (sender_role in ('visitor', 'owner', 'bot')),
  body text not null,
  created_at timestamptz not null default now(),
  constraint message_body_length check (char_length(btrim(body)) between 1 and 4000),
  constraint message_sender_kind check (
    sender_role <> 'bot' or sender_id is null
  )
);
create index chat_messages_session_created_idx on public.chat_messages(session_id, created_at, id);
create index chat_messages_sender_created_idx on public.chat_messages(sender_id, created_at desc);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from public, anon, authenticated;
grant select on public.chat_messages to authenticated;
grant insert (session_id, body) on public.chat_messages to authenticated;
grant all on public.chat_messages to service_role;

create function om_chat_private.prepare_message()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  chat public.chat_sessions%rowtype;
  actor_is_admin boolean;
begin
  new.body := btrim(new.body);
  new.created_at := clock_timestamp();
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    if new.sender_role = 'bot' then new.sender_id := null; end if;
    return new;
  end if;
  if actor is null then
    raise exception 'Sign in before sending a message' using errcode = '42501';
  end if;
  select * into chat from public.chat_sessions where id = new.session_id;
  if not found then
    raise exception 'Chat is not accessible' using errcode = '42501';
  end if;
  actor_is_admin := om_chat_private.is_admin();
  if not actor_is_admin and (chat.visitor_id <> actor or chat.status <> 'open') then
    raise exception 'Chat is not open for this visitor' using errcode = '42501';
  end if;
  if not actor_is_admin then
    -- Serialize sends by one visitor so parallel requests cannot evade the limit.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 0));
    if (select count(*) from public.chat_messages
      where sender_id = actor and created_at > clock_timestamp() - interval '1 minute') >= 20 then
      raise exception 'Please wait before sending more messages' using errcode = 'P0001';
    end if;
  end if;
  new.sender_id := actor;
  new.sender_role := case when actor_is_admin then 'owner' else 'visitor' end;
  return new;
end;
$$;
revoke all on function om_chat_private.prepare_message() from public, anon, authenticated;
create trigger chat_message_prepare before insert on public.chat_messages
  for each row execute function om_chat_private.prepare_message();

create policy message_read on public.chat_messages for select to authenticated
  using ((select om_chat_private.is_admin()) or exists (
    select 1 from public.chat_sessions s
    where s.id = session_id and s.visitor_id = (select auth.uid())
  ));
create policy message_send on public.chat_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (
    (sender_role = 'owner' and (select om_chat_private.is_admin())) or
    (sender_role = 'visitor' and exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.visitor_id = (select auth.uid()) and s.status = 'open'
    ))
  ));

create table public.bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  question text not null check (char_length(btrim(question)) between 1 and 200),
  answer text not null check (char_length(btrim(answer)) between 1 and 4000),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.bot_knowledge enable row level security;
revoke all on public.bot_knowledge from public, anon, authenticated;
grant select on public.bot_knowledge to anon, authenticated;
grant insert (slug, question, answer, is_published) on public.bot_knowledge to authenticated;
grant update (slug, question, answer, is_published), delete on public.bot_knowledge to authenticated;
grant all on public.bot_knowledge to service_role;
create policy knowledge_public_read on public.bot_knowledge for select to anon
  using (is_published);
create policy knowledge_member_read on public.bot_knowledge for select to authenticated
  using (is_published or (select om_chat_private.is_admin()));
create policy knowledge_owner_insert on public.bot_knowledge for insert to authenticated
  with check ((select om_chat_private.is_admin()));
create policy knowledge_owner_update on public.bot_knowledge for update to authenticated
  using ((select om_chat_private.is_admin())) with check ((select om_chat_private.is_admin()));
create policy knowledge_owner_delete on public.bot_knowledge for delete to authenticated
  using ((select om_chat_private.is_admin()));

-- Invoker security keeps the base-table RLS active for every caller.
create view public.chat_inbox with (security_invoker = true) as
select s.id, s.visitor_id, s.display_name, s.status, s.created_at, s.last_admin_read_at,
  (select max(m.created_at) from public.chat_messages m where m.session_id = s.id) as last_message_at,
  (select count(*) from public.chat_messages m where m.session_id = s.id
    and m.sender_role = 'visitor'
    and m.created_at > coalesce(s.last_admin_read_at, '-infinity'::timestamptz)) as unread_count
from public.chat_sessions s;
revoke all on public.chat_inbox from public, anon, authenticated;
grant select on public.chat_inbox to authenticated, service_role;

comment on table public.chat_sessions is 'Private visitor chats; identity comes from Supabase Auth.';
comment on table public.chat_messages is 'Immutable chat messages; sender role is assigned by the database.';
comment on table public.bot_knowledge is 'Only published, owner-approved answers may be shown to visitors.';
comment on table public.site_admins is 'Preapproved owners; clients cannot add owners or read approval emails.';
comment on view public.chat_inbox is 'RLS-aware session list with unread visitor message counts.';
