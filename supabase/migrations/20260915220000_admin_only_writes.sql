-- Only the site admin may change banners, corporate actions and market flows, or
-- upload banner images. These tables used to accept writes from ANY signed-in user,
-- and the site has a public signup page. The syncs and manage-unlisted-shares write
-- with the service role, which bypasses RLS, so they are unaffected.
--
-- The admin flag lives in app_metadata, which users cannot edit themselves. It reaches
-- the JWT on the next sign-in, so the admin must sign out and back in once.

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

grant execute on function public.is_admin() to anon, authenticated;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
where email = 'parasrampnp@gmail.com';

-- banner_messages
drop policy if exists "Authenticated users can view all banners" on public.banner_messages;
drop policy if exists "Authenticated users can insert banners" on public.banner_messages;
drop policy if exists "Authenticated users can update banners" on public.banner_messages;
drop policy if exists "Authenticated users can delete banners" on public.banner_messages;
create policy "Admin can view all banners" on public.banner_messages
  for select to authenticated using (public.is_admin());
create policy "Admin can insert banners" on public.banner_messages
  for insert to authenticated with check (public.is_admin());
create policy "Admin can update banners" on public.banner_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete banners" on public.banner_messages
  for delete to authenticated using (public.is_admin());

-- corporate_actions
drop policy if exists "Authenticated users can view all corporate actions" on public.corporate_actions;
drop policy if exists "Authenticated users can insert corporate actions" on public.corporate_actions;
drop policy if exists "Authenticated users can update corporate actions" on public.corporate_actions;
drop policy if exists "Authenticated users can delete corporate actions" on public.corporate_actions;
create policy "Admin can view all corporate actions" on public.corporate_actions
  for select to authenticated using (public.is_admin());
create policy "Admin can insert corporate actions" on public.corporate_actions
  for insert to authenticated with check (public.is_admin());
create policy "Admin can update corporate actions" on public.corporate_actions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete corporate actions" on public.corporate_actions
  for delete to authenticated using (public.is_admin());

-- market_flows
drop policy if exists "Authenticated users can insert market flows" on public.market_flows;
drop policy if exists "Authenticated users can update market flows" on public.market_flows;
drop policy if exists "Authenticated users can delete market flows" on public.market_flows;
create policy "Admin can insert market flows" on public.market_flows
  for insert to authenticated with check (public.is_admin());
create policy "Admin can update market flows" on public.market_flows
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admin can delete market flows" on public.market_flows
  for delete to authenticated using (public.is_admin());

-- banners bucket (policies were created in the dashboard, not in a migration)
drop policy if exists "Auth Insert" on storage.objects;
drop policy if exists "Auth Update" on storage.objects;
drop policy if exists "Admin can upload banners" on storage.objects;
drop policy if exists "Admin can replace banners" on storage.objects;
create policy "Admin can upload banners" on storage.objects
  for insert to authenticated with check (bucket_id = 'banners' and public.is_admin());
create policy "Admin can replace banners" on storage.objects
  for update to authenticated using (bucket_id = 'banners' and public.is_admin())
  with check (bucket_id = 'banners' and public.is_admin());
