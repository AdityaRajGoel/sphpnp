-- SEBI enforcement orders and corporate-action filings, per stock.
--
-- sync-sebi-actions searches SEBI's listings by company name - orders
-- (Enforcement -> Orders), buybacks, takeovers (open offers) and rights issues
-- - and keeps only results whose title names the company (see
-- _shared/sebi-actions.ts). Individuals' PANs are removed from titles before
-- they are stored.
--
-- Keyed on (symbol, url): one order can concern more than one listed company.

create table if not exists public.sebi_actions (
  id          bigint generated always as identity primary key,
  symbol      text not null,
  category    text not null check (category in ('order', 'buyback', 'open_offer', 'rights_issue')),
  -- "Settlement order", "Buyback - Public Announcement", ...
  kind        text not null,
  title       text not null,
  filed_on    date not null,
  url         text not null,
  fetched_at  timestamptz not null default now(),
  unique (symbol, url)
);

create index if not exists sebi_actions_symbol_idx on public.sebi_actions (symbol, filed_on desc);

alter table public.sebi_actions enable row level security;
create policy "SEBI actions are publicly readable"
  on public.sebi_actions for select using (true);
