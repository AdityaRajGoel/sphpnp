-- Free per-stock sources added 2026-09-11: NSE shareholding-pattern filings and
-- insider trades (sync-nse-disclosures), BSE announcements
-- (sync-bse-announcements), and screener.in / Tickertape company pages
-- (sync-screener-in, sync-tickertape).

create table if not exists public.nse_shareholding_filings (
  symbol              text not null,
  quarter_end         date not null,
  promoter_pct        numeric,
  public_pct          numeric,
  employee_trust_pct  numeric,
  xbrl_url            text,
  filed_at            timestamptz,
  record_id           text not null,
  fetched_at          timestamptz not null default now(),
  primary key (symbol, quarter_end)
);

create table if not exists public.nse_insider_trades (
  disclosure_id     text primary key,
  symbol            text not null,
  person            text not null,
  category          text,
  transaction       text not null check (transaction in ('buy', 'sell', 'pledge', 'revoke', 'other')),
  mode              text,
  security          text,
  quantity          numeric,
  value             numeric,
  holding_after_pct numeric,
  traded_from       date,
  traded_to         date,
  disclosed_at      timestamptz,
  xbrl_url          text,
  fetched_at        timestamptz not null default now()
);
create index if not exists nse_insider_trades_symbol_idx on public.nse_insider_trades (symbol, disclosed_at desc nulls last);

create table if not exists public.bse_announcements (
  news_id        text primary key,
  symbol         text not null,
  scrip_code     text not null,
  subject        text not null,
  summary        text,
  category       text,
  subcategory    text,
  critical       boolean not null default false,
  attachment_url text,
  published_at   timestamptz,
  fetched_at     timestamptz not null default now()
);
create index if not exists bse_announcements_symbol_idx on public.bse_announcements (symbol, published_at desc nulls last);

alter table public.stock_profiles
  add column if not exists screener             jsonb,
  add column if not exists screener_fetched_at  timestamptz,
  add column if not exists screener_error       text,
  add column if not exists tickertape           jsonb,
  add column if not exists tickertape_sid       text,
  add column if not exists tickertape_fetched_at timestamptz,
  add column if not exists tickertape_error     text;

-- screener.in statements feed the screener's fundamentals too.
alter table public.stock_fundamentals_summary drop constraint if exists stock_fundamentals_summary_source_check;
alter table public.stock_fundamentals_summary
  add constraint stock_fundamentals_summary_source_check check (source in ('indianapi', 'google_finance', 'screener_in'));

alter table public.nse_shareholding_filings enable row level security;
alter table public.nse_insider_trades enable row level security;
alter table public.bse_announcements enable row level security;

drop policy if exists "nse_shareholding_filings public read" on public.nse_shareholding_filings;
create policy "nse_shareholding_filings public read" on public.nse_shareholding_filings for select using (true);
drop policy if exists "nse_insider_trades public read" on public.nse_insider_trades;
create policy "nse_insider_trades public read" on public.nse_insider_trades for select using (true);
drop policy if exists "bse_announcements public read" on public.bse_announcements;
create policy "bse_announcements public read" on public.bse_announcements for select using (true);
