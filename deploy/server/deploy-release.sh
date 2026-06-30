#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:?Usage: deploy-release.sh /path/to/bodydashboard.tar.gz}"
APP_ROOT=/opt/bodydashboard
APP_USER=bodydashboard
DATA_ROOT=/var/lib/bodydashboard
WEB_ROOT=/etc/www/bodydashboard
ENV_FILE=/etc/bodydashboard/bodydashboard.env
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_ID}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Run bootstrap-server.sh and configure production secrets first." >&2
  exit 1
fi

mkdir -p "${RELEASE_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${RELEASE_DIR}"

cd "${RELEASE_DIR}"
npm ci
npm run db:generate
npm run build

set -a
source "${ENV_FILE}"
set +a

cd "${RELEASE_DIR}/apps/api"
npx prisma migrate deploy
chown -R "${APP_USER}:${APP_USER}" "${DATA_ROOT}"

ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"
chown -h "${APP_USER}:${APP_USER}" "${APP_ROOT}/current"

mkdir -p "${WEB_ROOT}"
rsync -a --delete "${RELEASE_DIR}/apps/web/dist/" "${WEB_ROOT}/"
chown -R "${APP_USER}:${APP_USER}" "${WEB_ROOT}"

systemctl restart bodydashboard-api
systemctl reload apache2

find "${APP_ROOT}/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

echo "Bodydashboard release ${RELEASE_ID} deployed."
