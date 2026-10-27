-- Football storage only: no chat messages, API keys, or personal data.
create table public.football_fixtures (
  fixture_id bigint primary key check (fixture_id > 0),
  kickoff_at timestamptz not null,
  status text not null,
  league_name text not null,
  home_name text not null,
  away_name text not null,
  home_goals integer check (home_goals >= 0),
  away_goals integer check (away_goals >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  fetched_at timestamptz not null,
  source text not null default 'API-Football'
);
create index football_fixtures_kickoff_idx on public.football_fixtures(kickoff_at);
create table public.football_predictions (
  fixture_id bigint primary key references public.football_fixtures(fixture_id) on delete cascade,
  home_percent numeric not null check (home_percent between 0 and 100),
  draw_percent numeric not null check (draw_percent between 0 and 100),
  away_percent numeric not null check (away_percent between 0 and 100),
  fetched_at timestamptz not null,
  source text not null default 'API-Football',
  check (abs(home_percent + draw_percent + away_percent - 100) <= 1)
);
create table public.football_api_cache (
  cache_key text primary key check (char_length(cache_key) between 1 and 300),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  fetched_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > fetched_at)
);
create index football_api_cache_expiry_idx on public.football_api_cache(expires_at);
alter table public.football_fixtures enable row level security;
alter table public.football_predictions enable row level security;
alter table public.football_api_cache enable row level security;
revoke all on public.football_fixtures, public.football_predictions, public.football_api_cache from anon, authenticated;
grant select, insert, update, delete on public.football_fixtures, public.football_predictions, public.football_api_cache to service_role;
comment on table public.football_fixtures is 'Provider match snapshots; backend access only, never user chat.';
comment on table public.football_predictions is 'Provider prematch probabilities; never invented by the bot.';
comment on table public.football_api_cache is 'Backend-only expiring provider cache; no keys or chat text.';
create policy backend_only on public.football_fixtures for all to service_role using (true) with check (true);
create policy backend_only on public.football_predictions for all to service_role using (true) with check (true);
create policy backend_only on public.football_api_cache for all to service_role using (true) with check (true);
