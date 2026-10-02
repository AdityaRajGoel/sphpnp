-- Every open-ended growth mutual fund scheme (direct and regular), from AMFI's
-- NAVAll, with its NAV a month to five years back from AMFI's NAV history
-- report. sync-mf-schemes writes it; /mutual-funds reads it. Returns are
-- generated from the stored NAVs so they can never drift from them:
-- simple change up to a year, compound annual beyond.
create table if not exists public.mf_schemes (
  scheme_code text primary key,
  scheme_name text not null,
  amc text,
  category text not null,
  plan text not null check (plan in ('direct', 'regular')),
  isin text,
  nav numeric not null,
  nav_date date not null,
  nav_1m numeric,
  nav_3m numeric,
  nav_6m numeric,
  nav_1y numeric,
  nav_3y numeric,
  nav_5y numeric,
  ret_1m numeric generated always as (case when nav_1m > 0 then round((nav / nav_1m - 1) * 100, 2) end) stored,
  ret_3m numeric generated always as (case when nav_3m > 0 then round((nav / nav_3m - 1) * 100, 2) end) stored,
  ret_6m numeric generated always as (case when nav_6m > 0 then round((nav / nav_6m - 1) * 100, 2) end) stored,
  ret_1y numeric generated always as (case when nav_1y > 0 then round((nav / nav_1y - 1) * 100, 2) end) stored,
  ret_3y numeric generated always as (case when nav_3y > 0 then round(((power(nav / nav_3y, 1.0 / 3) - 1) * 100)::numeric, 2) end) stored,
  ret_5y numeric generated always as (case when nav_5y > 0 then round(((power(nav / nav_5y, 1.0 / 5) - 1) * 100)::numeric, 2) end) stored,
  updated_at timestamptz not null default now()
);

create index if not exists mf_schemes_category_plan_idx on public.mf_schemes (category, plan);

alter table public.mf_schemes enable row level security;
drop policy if exists "mf_schemes public read" on public.mf_schemes;
create policy "mf_schemes public read" on public.mf_schemes for select using (true);

-- Sets one look-back NAV column for many schemes in a single statement.
-- p_rows: [{"scheme_code": "...", "nav": 12.3}, ...]. The column name is
-- whitelisted before it reaches the dynamic SQL.
create or replace function public.mf_set_anchor(p_anchor text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if p_anchor not in ('1m', '3m', '6m', '1y', '3y', '5y') then
    raise exception 'unknown anchor %', p_anchor;
  end if;
  execute format(
    'update mf_schemes s set %I = r.nav from jsonb_to_recordset($1) as r(scheme_code text, nav numeric) where s.scheme_code = r.scheme_code',
    'nav_' || p_anchor
  ) using p_rows;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.mf_set_anchor(text, jsonb) from public, anon, authenticated;
grant execute on function public.mf_set_anchor(text, jsonb) to service_role;
