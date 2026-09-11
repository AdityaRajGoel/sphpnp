-- The site-wide live-updates ticker, composed by the ticker-feed function from
-- the IPO, stock, corporate-action and announcement tables plus one Google
-- News search. One row, rebuilt when a visitor finds it more than five minutes old.
create table if not exists public.ticker_feed (
  id text primary key,
  items jsonb not null default '[]'::jsonb,
  built_at timestamptz not null default now()
);

alter table public.ticker_feed enable row level security;

drop policy if exists "ticker_feed public read" on public.ticker_feed;
create policy "ticker_feed public read" on public.ticker_feed for select using (true);
