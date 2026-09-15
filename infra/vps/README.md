# sphpnp VPS

Self-hosted backend (and later the website) for sphpnp.com on a single Contabo VPS.
Runs **in parallel** with the current Supabase project until every feature is verified,
then the site switches over and Supabase is retired.

| | |
|---|---|
| Host | Contabo KVM, 4 vCPU AMD EPYC, 7.8 GB RAM, 100 GB SSD |
| OS | Ubuntu 24.04 LTS |
| Admin user | `deploy` (SSH key only; root login disabled) |

## What runs

```
Visitors ──► nginx + Let's Encrypt (ufw: 22, 80, 443; certbot.timer renews)
   www.sphpnp.com     ── production prerendered build  (/var/www/sphpnp/current)
   sphpnp.com         ── 301 to www
   staging.sphpnp.com ── staging build, noindex         (/var/www/staging/current)
   api.sphpnp.com     ── /rest /auth /storage /functions /graphql only
                           │
   Supabase Docker Compose in /opt/supabase (every port bound to 127.0.0.1)
     gateway ─► auth · PostgREST · storage · edge functions · realtime
     Supavisor ─► Postgres 17          Studio: SSH tunnel only
   cron (/etc/cron.d/sphpnp-sync) ─► jobs/sync.sh ─► local functions
```

## Phases

1. **Base server** - `bootstrap/` scripts below - done
2. **Backend stack** - self-hosted Supabase (`supabase/`) - done
3. **Data** - production roles, schema, data, storage files, `post-restore.sql` - done
4. **Jobs** - `jobs/`: every GitHub sync workflow as a cron entry - done
5. **Backups** - daily on the server - done; off-server copy once an `offsite` rclone remote exists
6. **Verification and cutover** - compared against Supabase; DNS moved 15 September 2026 - done
7. **Web hosting** - `www.sphpnp.com` served from the VPS - done

## Deploying the website

```sh
rsync -az --delete --exclude node_modules --exclude dist --exclude .git --exclude '.env*' ./ sphpnp-vps:/opt/sphpnp/app/
ssh sphpnp-vps 'cd /opt/sphpnp/app && npm ci && ANON=$(grep ^ANON_KEY= /opt/supabase/.env | cut -d= -f2-) \
  && VITE_SUPABASE_URL=https://api.sphpnp.com VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" npm run build'
ssh sphpnp-vps /opt/sphpnp/jobs/deploy-site.sh   # validates dist/, publishes it, keeps 5 releases
```

`jobs/deploy-site.sh` refuses a build missing `index.html`, `404.html`, the IPO shell, the
sitemap or robots.txt, or with fewer than 300 prerendered pages. Roll back by pointing
`/var/www/sphpnp/current` at an older folder in `/var/www/sphpnp/releases`.

`npm run build` also writes the sitemap and prerenders every page (no build time limit on
the VPS). `nginx/sphpnp-com.conf` and `nginx/sphpnp-headers.conf` carry the redirects, clean
URLs and security headers that used to live in `vercel.json`.

## Nightly rebuild and performance

`jobs/build-site.sh` runs at 04:30 IST: `npm run build` (sitemap, prerender of every page,
IndexNow), then `deploy-site.sh`. A failed build or a rejected `dist/` leaves the live site
as it was; the result is logged to the day's sync log. The prerender refuses any page
captured before its `<head>` (title, description, canonical, JSON-LD) was written.

nginx serves HTTP/2 on every TLS listener. `deploy-site.sh` writes `.br` and `.gz` copies of
every text file and nginx serves them with `brotli_static` / `gzip_static` (brotli modules:
`libnginx-mod-http-brotli-static`, `libnginx-mod-http-brotli-filter`). HTML is cached for 5
minutes with background revalidation, images and video for a week, and hashed `/assets`
for a year. Visitors are mostly in India and the server is in Europe; a free Cloudflare
proxy in front of `www` would cut handshake and first-byte time there (keep `api` DNS-only
and use Full (strict) TLS) - not enabled.

## Ops tools and admin panel

`tools/` runs free, self-hosted tools in a separate Compose project (`/opt/sphpnp-tools`,
own Postgres and Valkey, every port bound to 127.0.0.1). Install or update with
`bash tools/setup.sh`; secrets are generated once into `/opt/sphpnp-tools/.env` (mode 600).

| Tool | Does | Admin URL |
|---|---|---|
| Umami | visitor analytics (tracker served same-origin at `/insights.js`) | `https://admin.sphpnp.com:8441` |
| GlitchTip | browser errors via `@sentry/react` (ingest proxied at `/api/1/envelope/`) | `https://admin.sphpnp.com:8442` |
| Uptime Kuma | uptime checks and alerts | `https://admin.sphpnp.com:8443` |
| Beszel | server and container metrics (start the agent after adding its key) | `https://admin.sphpnp.com:8444` |
| Supabase Studio | database, auth users, storage | `https://admin.sphpnp.com:8445` |

`https://admin.sphpnp.com` lists them. The tools do not run under a sub-path, so each keeps
its own port on the one hostname and certificate (`nginx/admin.conf`). Every port asks for
the admin login first (basic auth, SHA-512 hash in `/etc/nginx/admin.htpasswd`), then the
tool's own login. Studio's gateway credentials are added by nginx from a root-only snippet
generated from `/opt/supabase/.env`. vnStat and GoAccess are installed for bandwidth and
traffic reports.

## Logs and errors

- `jobs/logs-archive.sh` (00:20 IST): each container's logs for the previous day, gzipped, in
  `/var/log/sphpnp/containers/<date>/` (90 days), nginx error lines in
  `/var/log/sphpnp/nginx/` (90 days), and one digest of container errors, nginx errors,
  failed syncs and failed builds in `/var/log/sphpnp/errors/<date>.log` (365 days).
- `jobs/traffic-report.sh` (00:40 IST): GoAccess HTML report in `/var/log/sphpnp/traffic/`.
- Sync, backup and build results: `/var/log/sphpnp-sync/<date>.log`; build output in
  `/opt/sphpnp/build-logs/`.
- Browser errors: GlitchTip project `website`, only from www.sphpnp.com in a real browser.

## Firewall and rate limits

- ufw: 22 (rate-limited), 80, 443 and 8441-8445 (admin tools, behind basic auth). Docker
  ports are all on 127.0.0.1, which ufw cannot see, so nothing else is reachable.
- fail2ban (`security/fail2ban-nginx.local`): `sshd`, `recidive`, `nginx-botsearch`
  (vulnerability scanners), `nginx-http-auth` (5 wrong admin passwords in 10 minutes = 1 h
  ban) and `nginx-limit-req`.
- nginx rate limits (`nginx/rate-limits.conf`) were sized from real traffic: a stock page
  fires 21-40 API requests in a second and mobile users share IPs, so the API allows 50 r/s
  with a burst of 300 per IP. The VPS's own addresses are exempt; the prerender calls the
  API through its public hostname and was otherwise throttled into failed builds.
- Changing a zone's key or size needs `systemctl restart nginx`: a reload fails and nginx
  keeps the old config even though `nginx -t` passes. Check `error.log` after reloads.

## Edge function auth

Self-hosted Supabase applies one `FUNCTIONS_VERIFY_JWT` setting to every function (hosted
Supabase reads `verify_jwt` per function from `supabase/config.toml`). It stays `false`:
`telegram-webhook` receives Telegram's calls without a JWT, and the anon key a JWT check
would demand is public anyway. Functions that matter guard themselves: `sync-*` and
`ingest-forecasts` with `SYNC_SECRET`, admin functions with `ADMIN_PASSWORD` and a lockout,
`telegram-webhook` with its secret token, and `ai-stock-analysis` with its rate limiter.

## Backups

`jobs/backup.sh` runs at 03:15 IST into `/var/backups/sphpnp/<date-time>/`: the whole
database (`pg_dump -Fc`, verified with `pg_restore --list`), roles, uploaded files, and the
config and secrets (`.env`, `functions.env`, nginx, cron), with SHA256SUMS. Seven days are
kept. To copy backups off the server, create an encrypted rclone remote named `offsite`
(crypt over Backblaze B2); the script picks it up automatically and keeps 30 days there.

Restore: `pg_restore -U postgres -d postgres --clean --if-exists postgres.dump` inside
`supabase-db`, then untar `storage.tar.gz` into `/opt/supabase/volumes`.

## Restoring production data

`supabase db dump` only covers `public`, and storage files are not in the database, so a
restore is four steps:

1. Roles, then schema, then data (`db dump --linked --dry-run` scripts run on the server).
2. `supabase/post-restore.sql` - the signup trigger on `auth.users` and the storage policies.
3. Storage files - download each `storage.objects` row from the old project's public URL
   and upload it to `http://127.0.0.1:8000/storage/v1/object/<bucket>/<name>` with the
   service role key and `x-upsert: true`.
4. Check: table counts, `pg_policies` for `public` and `storage`, one public object URL.

## Jobs

`jobs/sphpnp-sync.cron` is copied to `/etc/cron.d/sphpnp-sync`; the server clock is IST.
Logs go to `/var/log/sphpnp-sync/YYYY-MM-DD.log` (two weeks kept).

| Script | Does |
|---|---|
| `sync.sh` | calls a sync function (`once`, `repeat`, `loop`, `market-data`, `market-backfill`) |
| `ipo-browser.sh` | Playwright render of InvestorGain + Chittorgarh, posted to `sync-ipos` |
| `mospi.sh` | MoSPI CPI/IIP/WPI via Node (legacy TLS), posted to `sync-market-data` |
| `kronos.sh` | weekly Kronos forecast (Python venv in `/opt/sphpnp/kronos-venv`) |

`sync-stock-statements` stays unscheduled, as on GitHub, until it is sized against the
IndianAPI quota.

## Bootstrap (phase 1)

Idempotent; safe to re-run. Run as root, in order:

```sh
scp -r infra/vps/bootstrap root@HOST:/root/
ssh root@HOST 'bash /root/bootstrap/01-base-system.sh'
ssh root@HOST 'bash /root/bootstrap/02-docker.sh'
ssh root@HOST 'bash /root/bootstrap/03-tooling.sh'
ssh root@HOST 'bash /root/bootstrap/04-access.sh'
# verify:  ssh deploy@HOST 'sudo -n true && docker ps'
ssh root@HOST 'bash /root/bootstrap/05-ssh-lockdown.sh'   # disables root + password login
```

After step 05, connect as `deploy`. If SSH is ever unreachable, use the VNC console in
the Contabo control panel.

| Script | Does |
|---|---|
| `01-base-system.sh` | hostname, IST timezone, full upgrade, base packages, 4 GB swap, sysctl hardening, journald cap, unattended security updates, chrony, auditd |
| `02-docker.sh` | Docker Engine + Compose plugin from Docker's repo, log rotation, live-restore |
| `03-tooling.sh` | Node 22, PostgreSQL 17 client, Supabase CLI, Deno, nginx + brotli modules, certbot (auto-renew), brotli/pigz, cloudflared, rclone, age, Chromium libraries for the prerender (Caddy installed but disabled) |
| `04-access.sh` | `deploy` user with key login, ufw (SSH only, rate-limited), fail2ban |
| `05-ssh-lockdown.sh` | key-only SSH, no root login, `AllowUsers deploy` |
