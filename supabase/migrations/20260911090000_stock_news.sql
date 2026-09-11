-- Recent Google News coverage per listed stock, cached by the stock-news
-- function (fetched on demand when a stock page asks, reused for two hours).
create table if not exists public.stock_news (
  symbol text primary key,
  items jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.stock_news enable row level security;

drop policy if exists "stock_news public read" on public.stock_news;
create policy "stock_news public read" on public.stock_news for select using (true);
