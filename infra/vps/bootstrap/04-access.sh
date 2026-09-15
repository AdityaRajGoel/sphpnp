#!/usr/bin/env bash
# Admin user, firewall and brute-force protection. Does NOT close root SSH yet -
# that is 05-ssh-lockdown.sh, run only after deploy login is verified.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

ADMIN_USER="deploy"

if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo,docker,adm "$ADMIN_USER"

# Same keys root accepts today; no password ever set for this account.
install -d -m 0700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
install -m 0600 -o "$ADMIN_USER" -g "$ADMIN_USER" /root/.ssh/authorized_keys "/home/$ADMIN_USER/.ssh/authorized_keys"

# Passwordless sudo: the account has no password and is reachable only by key.
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-$ADMIN_USER
chmod 0440 /etc/sudoers.d/90-$ADMIN_USER
visudo -cf /etc/sudoers.d/90-$ADMIN_USER

# Firewall: nothing inbound except SSH, rate-limited. Web ports open in the web phase
# (or never, if Cloudflare Tunnel carries the traffic). Containers bind to 127.0.0.1,
# because Docker-published ports bypass ufw.
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment 'SSH (rate-limited)'
ufw --force enable

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
backend = systemd
banaction = ufw
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

# Repeat offenders across jails get a week.
[recidive]
enabled = true
logpath = /var/log/fail2ban.log
backend = auto
bantime = 7d
findtime = 1d
maxretry = 3
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

ufw status verbose
fail2ban-client status
