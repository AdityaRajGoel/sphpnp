-- Offer documents and news for each IPO, both gathered by sync-ipo-details.
--
-- rhp_url / drhp_url have existed since the IPO tables were created and
-- nothing filled them. Chittorgarh's issue page links the RHP wherever the
-- issue hosts it (SEBI, the lead manager, the company), and with it the anchor
-- investors letter, the registrar's allotment-status page and the company site.
-- News comes from Google News' RSS search for the company's name.

alter table public.ipos
  -- [{ "kind": "rhp", "label": "Red Herring Prospectus (RHP)", "url": "https://..." }, ...]
  add column if not exists documents        jsonb,
  -- [{ "title": "...", "source": "Reuters", "url": "https://...", "published_at": "..." }, ...]
  add column if not exists news             jsonb,
  add column if not exists news_fetched_at  timestamptz;
