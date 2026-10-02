-- XBRL links NSE answers with 404. Its filing registry keeps listing revisions
-- whose documents were withdrawn (sometimes the latest one), and sync-fundamentals
-- re-fetched each of them on every run. It now skips these and takes the latest
-- revision that remains. Delete a row to have its link tried again.
create table if not exists public.nse_dead_documents (
  url text primary key,
  symbol text not null,
  first_seen_at timestamptz not null default now()
);

alter table public.nse_dead_documents enable row level security;
