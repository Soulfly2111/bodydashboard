#!/usr/bin/env bash
set -euo pipefail

APP_USER=bodydashboard
APP_ROOT=/opt/bodydashboard
DATA_ROOT=/var/lib/bodydashboard
ENV_ROOT=/etc/bodydashboard
WEB_ROOT=/etc/www/bodydashboard

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git apache2 rsync

if systemctl list-unit-files nginx.service >/dev/null 2>&1; then
  systemctl stop nginx >/dev/null 2>&1 || true
  systemctl disable nginx >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --home "${APP_ROOT}" --shell /usr/sbin/nologin "${APP_USER}"

mkdir -p "${APP_ROOT}/releases" "${APP_ROOT}/deploy" "${DATA_ROOT}" "${ENV_ROOT}" "${WEB_ROOT}"
chown -R "${APP_USER}:${APP_USER}" "${APP_ROOT}" "${DATA_ROOT}" "${WEB_ROOT}"
chmod 750 "${ENV_ROOT}"

if [[ ! -f "${ENV_ROOT}/bodydashboard.env" ]]; then
  install -m 640 -o root -g "${APP_USER}" deploy/server/bodydashboard.env.example "${ENV_ROOT}/bodydashboard.env"
  echo "Created ${ENV_ROOT}/bodydashboard.env. Edit secrets before first deploy."
fi

install -m 755 deploy/server/deploy-release.sh "${APP_ROOT}/deploy/deploy-release.sh"
install -m 644 deploy/systemd/bodydashboard-api.service /etc/systemd/system/bodydashboard-api.service
a2enmod proxy proxy_http rewrite headers

if [[ -f /etc/apache2/sites-available/bodydashboard.conf ]]; then
  echo "Keeping existing /etc/apache2/sites-available/bodydashboard.conf."
else
  install -m 644 deploy/apache/bodydashboard.conf /etc/apache2/sites-available/bodydashboard.conf
  a2ensite bodydashboard.conf
fi

systemctl daemon-reload
apachectl configtest
systemctl enable apache2
systemctl reload apache2

echo "Bootstrap complete. Configure ${ENV_ROOT}/bodydashboard.env and GitHub Secrets, then push to main."
