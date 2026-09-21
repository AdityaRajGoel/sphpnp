-- The promoters' own pledge, read from each quarter's shareholding-pattern XBRL.
-- NSE's aggregate pledge feed went empty on 21 Sep 2026, and until then it was
-- parsed from the wrong column (every depository pledge, not the promoters').
alter table public.nse_shareholding_filings
  add column if not exists promoter_shares numeric,
  add column if not exists promoter_pledged_shares numeric,
  add column if not exists promoter_pledged_pct numeric;
