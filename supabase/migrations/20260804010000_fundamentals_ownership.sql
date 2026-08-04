-- Ownership and corporate actions, both from NSE endpoints verified to return
-- 200 for a plain GET with a Referer header.

create table if not exists shareholding_pattern (
  id                   bigint generated always as identity primary key,
  symbol               text not null,
  period_end           date not null,
  promoter_pct         numeric,
  promoter_pledged_pct numeric,
  fii_pct              numeric,
  dii_pct              numeric,
  public_pct           numeric,
  source               text not null default 'nse',
  fetched_at           timestamptz not null default now(),
  unique (symbol, period_end)
);

create table if not exists corporate_actions (
  id           bigint generated always as identity primary key,
  symbol       text not null,
  ex_date      date not null,
  record_date  date,
  action_type  text not null,
  value        numeric,
  description  text,
  source       text not null default 'nse',
  fetched_at   timestamptz not null default now(),
  unique (symbol, ex_date, action_type)
);

create index if not exists corporate_actions_ex_date_idx
  on corporate_actions (ex_date desc);

alter table shareholding_pattern enable row level security;
alter table corporate_actions    enable row level security;

create policy "Anyone can view shareholding"
  on shareholding_pattern for select to anon, authenticated using (true);
create policy "Anyone can view corporate actions"
  on corporate_actions for select to anon, authenticated using (true);
