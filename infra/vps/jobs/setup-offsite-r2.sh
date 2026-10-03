#!/usr/bin/env bash
# One-time: point the nightly backup (jobs/backup.sh) at a Cloudflare R2 bucket,
# encrypted before it leaves the server. Run it yourself, in your own terminal, so the
# keys go straight to the server and never into a chat or a log:
#
#   ssh -t sphpnp-vps 'bash /opt/sphpnp/jobs/setup-offsite-r2.sh'
#
# It asks for the R2 account ID, access key ID and secret (from an R2 API token scoped
# to the bucket, "Object Read & Write"), writes two rclone remotes for the deploy user:
#   r2:      the bucket itself (S3 API, Cloudflare provider)
#   offsite: an rclone crypt layer over r2:<bucket>/nightly - what backup.sh copies to
# then generates the encryption passwords, prints them ONCE for you to save, and
# copies the latest backup up as a test.
set -euo pipefail
# The R2 token is IP-filtered to the IPv4 address; force IPv4 (see backup.sh).
export RCLONE_BIND=0.0.0.0

BUCKET="${BUCKET:-sphpnp-backups}"
CONF_USER=deploy
CONF_DIR=$(getent passwd "$CONF_USER" | cut -d: -f6)/.config/rclone
CONF="$CONF_DIR/rclone.conf"

read -rp "Cloudflare account ID (32 hex characters, from the R2 overview page): " ACCOUNT
read -rp "R2 access key ID: " KEY_ID
read -rsp "R2 secret access key (hidden): " SECRET; echo
[[ "$ACCOUNT" =~ ^[0-9a-f]{32}$ ]] || { echo "That account ID is not 32 hex characters." >&2; exit 1; }
[ -n "$KEY_ID" ] && [ -n "$SECRET" ] || { echo "Both keys are needed." >&2; exit 1; }

if sudo -u "$CONF_USER" rclone listremotes 2>/dev/null | grep -qx 'offsite:'; then
  echo "An 'offsite:' remote already exists for $CONF_USER; remove it first (rclone config delete offsite)." >&2
  exit 1
fi

# Two independent random passwords for rclone crypt (password and salt). Without them
# the backups cannot be decrypted, so they are shown once below and nowhere else.
P1=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)
P2=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)

sudo -u "$CONF_USER" mkdir -p "$CONF_DIR"
sudo -u "$CONF_USER" rclone config create r2 s3 \
  provider=Cloudflare access_key_id="$KEY_ID" secret_access_key="$SECRET" \
  endpoint="https://$ACCOUNT.r2.cloudflarestorage.com" acl=private no_check_bucket=true >/dev/null
sudo -u "$CONF_USER" rclone config create offsite crypt \
  remote="r2:$BUCKET/nightly" filename_encryption=standard directory_name_encryption=true \
  password="$(rclone obscure "$P1")" password2="$(rclone obscure "$P2")" >/dev/null
sudo chmod 600 "$CONF"

cat <<EOF

SAVE THESE TWO PASSWORDS NOW (a password manager, not this server). Without them the
backups in R2 cannot be decrypted, and if the server is lost they exist nowhere else:
  rclone crypt password : $P1
  rclone crypt password2: $P2
  bucket: $BUCKET   folder: nightly   account: $ACCOUNT
EOF

echo "Testing: copying the latest backup up..."
LATEST=$(ls -1d /var/backups/sphpnp/20* | tail -1)
sudo -u "$CONF_USER" rclone copy "$LATEST" "offsite:$(basename "$LATEST")" --transfers 2
sudo -u "$CONF_USER" rclone ls "offsite:$(basename "$LATEST")"

echo "Done. Tonight's backup (03:15 IST) and every one after it is also copied to R2, encrypted;"
echo "copies older than 30 days are removed there."
