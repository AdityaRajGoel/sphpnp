-- Persisted IPO catalogue and GMP history. GMP is an unofficial, unregulated
-- market signal, so snapshots are append-only: a later collection must never
-- rewrite what was observed earlier.

create table if not exists public.ipos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  board text not null check (board in ('mainboard', 'sme')),
  status text not null check (status in ('upcoming', 'open', 'closed', 'listed')),
  price_band_min numeric,
  price_band_max numeric,
  lot_size integer,
  issue_size_crore numeric,
  open_date date,
  close_date date,
  allotment_date date,
  listing_date date,
  registrar text,
  rhp_url text,
  drhp_url text,
  subscription_qib numeric,
  subscription_nii numeric,
  subscription_retail numeric,
  listing_price numeric,
  listing_gain_pct numeric,
  source text not null,
  source_url text,
  data_as_of timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ipos_status_open_date_idx on public.ipos (status, open_date desc nulls last);
create index if not exists ipos_listing_date_idx on public.ipos (listing_date desc nulls last);

create table if not exists public.ipo_gmp_snapshots (
  id bigint generated always as identity primary key,
  ipo_id uuid not null references public.ipos(id) on delete cascade,
  captured_at timestamptz not null,
  gmp numeric not null,
  est_listing_price numeric,
  source text not null,
  created_at timestamptz not null default now(),
  unique (ipo_id, captured_at)
);

create index if not exists ipo_gmp_snapshots_ipo_captured_idx
  on public.ipo_gmp_snapshots (ipo_id, captured_at asc);

alter table public.ipos enable row level security;
alter table public.ipo_gmp_snapshots enable row level security;

-- The sync writes with the service role. Visitors only need the published
-- catalogue and its historical snapshots; no anonymous write policy exists.
create policy "Published IPOs are publicly readable"
  on public.ipos for select using (true);

create policy "IPO GMP snapshots are publicly readable"
  on public.ipo_gmp_snapshots for select using (true);
