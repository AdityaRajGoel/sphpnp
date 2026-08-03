-- Extra fields the dealers publish alongside the price, for the rate-comparison
-- block on /unlisted-space. Additive only; existing rows keep working.
-- Run on the MAIN Supabase project (zbkjbbujsdlpujotgltm).
--
-- `as_of` is the date the dealer themselves stamp on the quote, which is not
-- the same as `fetched_at` (when we collected it). Showing the dealer's own
-- date is more honest than implying our collection time is the quote's age.
--
-- `quote_url` deep-links to the specific company page rather than the dealer's
-- index, so a reader can verify one number instead of hunting a list.

alter table unlisted_market_quotes
  add column if not exists lot_size  integer,
  add column if not exists as_of     date,
  add column if not exists quote_url text;
