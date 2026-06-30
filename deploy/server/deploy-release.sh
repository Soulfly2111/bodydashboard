#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:?Usage: deploy-release.sh /path/to/bodydashboard.tar.gz}"
APP_ROOT=/opt/bodydashboard
APP_USER=bodydashboard
RELEASE_ID="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_ID}"

mkdir -p "${RELEASE_DIR}"
tar -xzf "${ARCHIVE_PATH}" -C "${RELEASE_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${RELEASE_DIR}"

cd "${RELEASE_DIR}"
npm ci
npm run db:generate
npm run build

cd "${RELEASE_DIR}/apps/api"
npx prisma migrate deploy

ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"
chown -h "${APP_USER}:${APP_USER}" "${APP_ROOT}/current"

systemctl restart bodydashboard-api
systemctl reload nginx

find "${APP_ROOT}/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

echo "Bodydashboard release ${RELEASE_ID} deployed."
