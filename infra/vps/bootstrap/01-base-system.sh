#!/usr/bin/env bash
# Base system: identity, updates, packages, swap, kernel and log limits.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

hostnamectl set-hostname sphpnp-prod
timedatectl set-timezone Asia/Kolkata

apt-get update
apt-get -y -o Dpkg::Options::="--force-confold" full-upgrade
apt-get install -y --no-install-recommends \
  ca-certificates curl wget gnupg lsb-release apt-transport-https software-properties-common \
  git unzip zip jq tmux htop ncdu tree rsync zstd pigz \
  dnsutils net-tools lsof iotop sysstat \
  chrony logrotate unattended-upgrades apt-listchanges needrestart auditd \
  ufw fail2ban

# 4 GB swap: headroom so a memory spike slows Postgres instead of OOM-killing it.
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cat > /etc/sysctl.d/60-sphpnp.conf <<'EOF'
# Memory: prefer RAM, keep swap for emergencies.
vm.swappiness = 10
vm.vfs_cache_pressure = 50
# Network hardening.
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.log_martians = 1
# Kernel hardening.
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
# Many connections and file watchers for the container stack.
net.core.somaxconn = 4096
fs.inotify.max_user_watches = 524288
EOF
sysctl --system >/dev/null

mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/60-sphpnp.conf <<'EOF'
[Journal]
SystemMaxUse=1G
MaxRetentionSec=30day
EOF
systemctl restart systemd-journald

# Security updates install automatically; kernel reboots stay a deliberate action.
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52sphpnp-unattended <<'EOF'
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF

systemctl enable --now chrony auditd sysstat unattended-upgrades

# Resolve our own hostnames locally. Every name here is served by this machine, yet
# Gatus, Homepage and the jobs looked them up through Contabo's resolvers, and a
# dropped query cost a 5s client retry: 42 of 49 failed "Home page" checks were exactly
# that, not a slow site. Public DNS is still checked from outside by the GitHub
# vps-health workflow. cloud-init rewrites /etc/hosts at boot, so the template too.
PUBLIC_IP=$(curl -4 -s https://api.ipify.org || true)
if [ -n "$PUBLIC_IP" ]; then
  line="$PUBLIC_IP www.sphpnp.com sphpnp.com api.sphpnp.com staging.sphpnp.com admin.sphpnp.com"
  for f in /etc/hosts /etc/cloud/templates/hosts.debian.tmpl; do
    [ -f "$f" ] || continue
    sed -i '/ www\.sphpnp\.com /d' "$f"
    printf '%s\n' "$line" >> "$f"
  done
fi

echo "01-base-system done: $(hostname), $(timedatectl show -p Timezone --value), swap $(swapon --show --noheadings | awk '{print $3}')"
[ -f /var/run/reboot-required ] && echo "NOTE: reboot required to load updated kernel" || true
