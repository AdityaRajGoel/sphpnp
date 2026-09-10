-- Everything Chittorgarh's per-issue page publishes, for each IPO.
--
-- The list pages sync-ipos reads carry a lot size and a price band, but no
-- minimum investment - and lot x upper band is not the minimum: an SME
-- application must be at least two lots. The issue page publishes the minimum
-- per investor category, and with it the timetable, registrar, lead managers,
-- issue structure, company financials, KPIs, valuation, shareholding and the
-- objects of the issue. sync-ipo-details fetches it (directly, or through
-- Apify when a direct fetch is refused) and parses it with
-- _shared/ipo-detail.ts.
--
-- Facts worth filtering or showing on a card get a column. The page as a whole
-- is kept in `details` as its sections - tables as rows of cells, text as
-- lines - so the detail page can show all of it without a column per figure.

alter table public.ipos
  add column if not exists detail_url              text,
  add column if not exists min_investment          numeric,
  add column if not exists min_investment_lots     integer,
  add column if not exists min_investment_shares   integer,
  add column if not exists min_investment_category text,
  add column if not exists face_value              numeric,
  add column if not exists issue_type              text,
  add column if not exists sale_type               text,
  add column if not exists listing_exchanges       text,
  add column if not exists fresh_issue_crore       numeric,
  add column if not exists ofs_crore               numeric,
  add column if not exists refund_date             date,
  add column if not exists credit_date             date,
  add column if not exists lead_managers           text[],
  add column if not exists promoter_holding_pre    numeric,
  add column if not exists promoter_holding_post   numeric,
  -- [{ "title": "IPO Lot Size", "tables": [[["Application", "Lots", ...], ...]], "lines": [...] }]
  add column if not exists details                 jsonb,
  -- 'chittorgarh', or 'chittorgarh via apify' when the direct fetch was refused.
  add column if not exists details_source          text,
  -- Null until a fetch has parsed; an attempt that failed never sets it.
  add column if not exists details_fetched_at      timestamptz,
  -- Every attempt, success or not, so a page that cannot be read rotates to the
  -- back of the queue instead of being retried first on every run.
  add column if not exists details_attempted_at    timestamptz,
  add column if not exists details_error           text;

comment on column public.ipos.min_investment is
  'Rupees for the smallest application the issue page lists (Retail (Min), or Individual investors (Min) on SME), as published - never lot size x price.';
