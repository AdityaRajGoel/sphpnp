-- Objects outside the public schema that `supabase db dump` (public only) does not carry.
-- Run after restoring roles/schema/data; safe to re-run.
--   docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < post-restore.sql

-- Profile row for every new signup (migration 20260312093633).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Storage policies, as in production.
DROP POLICY IF EXISTS "Stock logos are publicly accessible" ON storage.objects;
CREATE POLICY "Stock logos are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'stock-logos');

-- Banner uploads are admin-only: the policies come from migration
-- 20260915220000_admin_only_writes.sql, applied after this file on a fresh restore.

-- Only ai-stock-analysis (service role) calls the rate limiter. Callable by anon, anyone
-- could fill the buckets and lock every visitor out of AI reports.
REVOKE EXECUTE ON FUNCTION public.check_ai_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(text, integer, integer) TO service_role;

-- Stored image links still pointing at the old project's storage.
UPDATE public.banner_messages SET image_url = replace(image_url, 'https://zbkjbbujsdlpujotgltm.supabase.co', 'https://api.sphpnp.com')
  WHERE image_url LIKE 'https://zbkjbbujsdlpujotgltm.supabase.co/%';
UPDATE public.unlisted_shares SET image_url = replace(image_url, 'https://zbkjbbujsdlpujotgltm.supabase.co', 'https://api.sphpnp.com')
  WHERE image_url LIKE 'https://zbkjbbujsdlpujotgltm.supabase.co/%';

-- Storage files are not in the database dump: copy each object from the old project's
-- public URL and re-upload it through the storage API with x-upsert (see README).
