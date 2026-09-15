#!/usr/bin/env bash
# Key-only SSH, no root login. Run ONLY after `ssh deploy@HOST 'sudo -n true'` works.
# Recovery if locked out: Contabo control panel -> VNC console.
set -euo pipefail

ADMIN_USER="deploy"

if [ ! -s "/home/$ADMIN_USER/.ssh/authorized_keys" ]; then
  echo "Refusing: /home/$ADMIN_USER/.ssh/authorized_keys is missing - run 04-access.sh first" >&2
  exit 1
fi

# sshd uses the first value it reads, and drop-ins are read in name order, so 00-
# overrides the provider's own drop-in that still says PasswordAuthentication yes.
cat > /etc/ssh/sshd_config.d/00-sphpnp-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers $ADMIN_USER
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

sshd -t
systemctl reload ssh
sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|allowusers|maxauthtries) '
