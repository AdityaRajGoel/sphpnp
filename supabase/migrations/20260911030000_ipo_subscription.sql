-- Subscription figures from each issue's Chittorgarh subscription page, read
-- by sync-ipo-details once bidding has opened.
--
-- subscription_qib / _nii / _retail have existed since 20260909000000 but
-- nothing filled them. The page also gives the total and the employee
-- quota, and says when it took the figures - kept, because a multiple from
-- day one of bidding and one from the close are different facts.

alter table public.ipos
  add column if not exists subscription_total      numeric,
  add column if not exists subscription_employee   numeric,
  -- [{ "category": "Non Institutional", "times": 11.6 }, ...] as the page lists them.
  add column if not exists subscription_categories jsonb,
  add column if not exists subscription_as_of      timestamptz;
