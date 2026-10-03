-- Postgres sized for this VPS (8 GB RAM, 4 vCPU, SSD; database ~400 MB, 3 Oct 2026).
-- The Supabase image ships near-stock defaults (128 MB cache assumed, 4 MB sort
-- memory, spinning-disk page costs). ALTER SYSTEM writes postgresql.auto.conf in the
-- data volume, so these survive container restarts and image updates.
--
-- Apply: docker exec -i supabase-db psql -U supabase_admin -d postgres < infra/vps/postgres-tuning.sql
-- The first five take effect on reload; shared_buffers needs a restart:
--   docker restart supabase-db   (a few seconds; the site errors meanwhile - pick a quiet time)
alter system set effective_cache_size = '3GB';      -- RAM the OS can spend caching the database
alter system set work_mem = '16MB';                 -- per sort/hash; x100 connections stays inside RAM
alter system set maintenance_work_mem = '256MB';    -- vacuum and index builds
alter system set random_page_cost = 1.1;            -- SSD: random reads cost about as much as sequential
alter system set effective_io_concurrency = 200;    -- SSD
alter system set shared_buffers = '1GB';            -- the whole database fits; restart required
select pg_reload_conf();
