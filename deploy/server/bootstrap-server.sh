#!/usr/bin/env bash
set -euo pipefail

APP_USER=bodydashboard
APP_ROOT=/opt/bodydashboard
DATA_ROOT=/var/lib/bodydashboard
ENV_ROOT=/etc/bodydashboard

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --home "${APP_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"

mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/deploy" "${DATA_ROOT}" "${ENV_ROOT}"
chown -R "${APP_USER}:${APP_USER}" "${APP_ROOT}" "${DATA_ROOT}"
chmod 750 "${ENV_ROOT}"

if [[ ! -f "${ENV_ROOT}/bodydashboard.env" ]]; then
  install -m 640 -o root -g "${APP_USER}" deploy/server/bodydashboard.env.example "${ENV_ROOT}/bodydashboard.env"
  echo "Created ${ENV_ROOT}/bodydashboard.env. Edit secrets before first deploy."
fi

install -m 755 deploy/server/deploy-release.sh "${APP_ROOT}/deploy/deploy-release.sh"
install -m 644 deploy/systemd/bodydashboard-api.service /etc/systemd/system/bodydashboard-api.service
install -m 644 deploy/nginx/bodydashboard.conf /etc/nginx/sites-available/bodydashboard.conf
ln -sfn /etc/nginx/sites-available/bodydashboard.conf /etc/nginx/sites-enabled/bodydashboard.conf
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "Bootstrap complete. Configure ${ENV_ROOT}/bodydashboard.env and GitHub Secrets, then push to main."
