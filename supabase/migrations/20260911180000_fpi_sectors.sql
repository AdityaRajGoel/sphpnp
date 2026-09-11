-- NSDL's fortnightly sector-wise FPI report: net investment and assets under
-- custody for each of BSE's sectors, per fortnight. Filled by
-- sync-market-data dataset "fpi_sectors".

create table if not exists public.fpi_sector_fortnightly (
  fortnight_end date not null,
  sector text not null,
  equity_net_cr numeric, debt_net_cr numeric, other_net_cr numeric, total_net_cr numeric,
  equity_net_usd_mn numeric, total_net_usd_mn numeric,
  equity_auc_cr numeric, total_auc_cr numeric, total_auc_usd_mn numeric,
  fetched_at timestamptz not null default now(),
  primary key (fortnight_end, sector)
);

alter table public.fpi_sector_fortnightly enable row level security;
drop policy if exists "fpi_sector_fortnightly public read" on public.fpi_sector_fortnightly;
create policy "fpi_sector_fortnightly public read" on public.fpi_sector_fortnightly for select using (true);
