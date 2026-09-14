-- The Piotroski score and the quality ratios are computed from DIFFERENT
-- periods, and the row needs to say so.
--
-- The ratios need one period; the score needs two a year apart with both an
-- income statement and a balance sheet. Measured on live data: 80 of 246
-- symbols have at least one period where the two statements align, and only 4
-- have a pair twelve months apart. So a row is keyed on the latest aligned
-- period - which is what the ratios describe - while the score, when it exists
-- at all, routinely comes from an earlier pair.
--
-- Without these columns a reader would reasonably assume the score describes
-- the period_end beside it, which for most scored symbols it does not.
alter table public.stock_fundamental_scores
  add column if not exists piotroski_period_end date,
  add column if not exists piotroski_compared_with date;
