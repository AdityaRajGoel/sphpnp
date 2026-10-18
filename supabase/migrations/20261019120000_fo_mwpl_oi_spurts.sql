-- How close each F&O stock is to the market-wide position limit, and which
-- underlyings saw the largest open-interest moves. Fed by sync-market-data
-- (datasets "mwpl" and "oi_spurts").
--
-- fo_mwpl: NSE's combined OI file (nsccl/mwpl/combineoi_<DDMMYYYY>.zip), one row
-- per F&O stock, replaced each trading day. A stock enters the ban when its
-- future-equivalent OI passes 95% of MWPL and leaves when it falls below 80%,
-- so utilisation_pct shows the ban coming before the ban list does.
create table if not exists fo_mwpl (
  symbol           text    primary key,
  isin             text,
  name             text,
  mwpl             numeric not null,
  open_interest    numeric not null,
  fut_equiv_oi     numeric not null,
  -- "No Fresh Positions" while in the ban, otherwise the headroom NSE allows next day.
  limit_next_day   text,
  utilisation_pct  numeric not null,
  as_of            date    not null,
  updated_at       timestamptz not null default now()
);
create index if not exists fo_mwpl_utilisation_idx on fo_mwpl (utilisation_pct desc);

-- fo_oi_spurts: NSE's live OI-spurts report by underlying (change in open
-- interest against the previous trading day), replaced on each run.
create table if not exists fo_oi_spurts (
  symbol          text    primary key,
  latest_oi       numeric not null,
  prev_oi         numeric not null,
  change_oi       numeric not null,
  change_pct      numeric,
  volume          numeric,
  underlying      numeric,
  trade_date      date    not null,
  updated_at      timestamptz not null default now()
);

alter table fo_mwpl enable row level security;
alter table fo_oi_spurts enable row level security;

drop policy if exists "Public can view MWPL utilisation" on fo_mwpl;
create policy "Public can view MWPL utilisation" on fo_mwpl for select using (true);
drop policy if exists "Public can view OI spurts" on fo_oi_spurts;
create policy "Public can view OI spurts" on fo_oi_spurts for select using (true);

-- Writes come only from the service role (sync-market-data).
