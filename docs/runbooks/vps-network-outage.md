# Runbook: VPS public-network outage

## Means

The public site, API gateway, and public edge-function probe are unavailable from outside the VPS. On 30 September 2026, the VPS was still running but lost reachability to both Contabo DNS resolvers and all public TCP ports. Nginx, Docker, disk, memory, and UFW were healthy; a VPS reboot restored service.

Cause, from `journalctl -b -1` and `/var/log/apt/history.log`: unattended-upgrade installed openssl at 02:44 IST and needrestart restarted `systemd-networkd` and `systemd-resolved`. DNS failed from 02:47, and public traffic stopped at about 05:15. `infra/vps/bootstrap/01-base-system.sh` now excludes both services from needrestart (`/etc/needrestart/conf.d/sphpnp-network.conf`).

The auto-recovery workflow below is a slow alarm, not a fast fix. GitHub runs its five-minute schedule only every few hours, and it can restart the VPS only once the Contabo secrets exist.

## Automated containment

`.github/workflows/vps-auto-recovery.yml` runs from GitHub-hosted infrastructure every five minutes. It checks the three critical public endpoints, waits one minute, then repeats them. Only if all three checks fail twice does it ask Contabo to restart the configured instance. A workflow failure remains visible even when the restart request succeeds, so GitHub's normal workflow-failure notification is the incident alert.

The edge-functions service also has explicit Cloudflare and Google DNS upstreams in `infra/vps/supabase/docker-compose.override.yml`. This prevents a Contabo-resolver-only outage from breaking upstream data calls while the container otherwise remains healthy.

## One-time setup

1. In Contabo's Customer Control Panel, create a dedicated API user restricted to the production instance and only the permission required to restart it. Do not use the main account password.
2. In GitHub repository Settings → Secrets and variables → Actions, create these repository secrets:

   - `CONTABO_CLIENT_ID`
   - `CONTABO_CLIENT_SECRET`
   - `CONTABO_API_USER`
   - `CONTABO_API_PASSWORD`
   - `CONTABO_INSTANCE_ID`

3. Trigger **VPS auto-recovery** manually once while the site is healthy. It must complete the probe and skip the restart job.
4. Deploy the updated Supabase Compose override, then recreate only the functions service:

   ```sh
   sudo install -m 644 infra/vps/supabase/docker-compose.override.yml /opt/supabase/docker-compose.override.yml
   cd /opt/supabase && sudo docker compose up -d --force-recreate functions
   ```

## First check during an incident

Open the failed **VPS auto-recovery** run. If its restart job failed, verify the five Contabo secrets and the API user's least-privilege access. If its restart job succeeded but the next probe still fails after five minutes, use the Contabo VNC console and open a Contabo support case with:

- incident start and recovery timestamps;
- the failed GitHub run URL;
- `journalctl -b -1` resolver/network errors; and
- confirmation that ports 22, 80, and 443 timed out from an external network.

Do not change UFW during this incident unless `sudo ufw status numbered` no longer contains the expected inbound rules for TCP 22, 80, and 443.
