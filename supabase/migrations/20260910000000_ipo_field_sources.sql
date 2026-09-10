-- Per-field provenance for the IPO catalogue.
--
-- The catalogue is now reconciled from three independent sources (IPO Watch,
-- InvestorGain, Chittorgarh) rather than scraped from one. Recording which
-- source supplied each field is what makes a wrong number traceable without
-- re-running the scrape, and it is what the detail page reads to attribute a
-- figure rather than presenting every field with equal, unearned confidence.
--
-- jsonb rather than columns: the set of reconciled fields changes whenever a
-- source is added or starts publishing something new, and that should not cost
-- a migration each time. Shape is { "<column>": "<source>" }, e.g.
--   {"price_band_min": "chittorgarh", "lot_size": "investorgain"}

alter table public.ipos
  add column if not exists field_sources jsonb;

comment on column public.ipos.field_sources is
  'Which source supplied each reconciled field: {"<column>": "ipowatch|investorgain|chittorgarh"}.';

-- GMP is an unofficial grey-market estimate that genuinely differs between
-- sites, so a snapshot records which sources contributed to the value stored
-- rather than implying a single authority.
alter table public.ipo_gmp_snapshots
  add column if not exists sources text[];

comment on column public.ipo_gmp_snapshots.sources is
  'Sources whose quotes were combined into this GMP observation.';
