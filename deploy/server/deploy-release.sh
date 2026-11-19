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
npm --prefix apps/mcp ci
npm --prefix apps/mcp run build

set -a
source "${ENV_FILE}"
set +a

# SQLite's online backup API produces a consistent backup, including WAL data.
BACKUP_DIR="${APP_ROOT}/backups/${RELEASE_ID}"
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
export BACKUP_DIR
python3 - <<'PY'
import os, sqlite3
from pathlib import Path
url = os.environ['DATABASE_URL']
if not url.startswith('file:'):
    raise SystemExit('Expected SQLite DATABASE_URL')
path = url[5:].split('?')[0]
if not Path(path).is_absolute():
    raise SystemExit('Production SQLite path must be absolute for a verified backup')
source = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
target = sqlite3.connect(os.path.join(os.environ['BACKUP_DIR'], 'database.sqlite'))
with target:
    source.backup(target)
assert target.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
target.close()
source.close()
PY
OLD_RELEASE="$(readlink -f "${APP_ROOT}/current")"
cp /opt/bodydashboard-mcp/server.bundle.js "${BACKUP_DIR}/mcp.bundle.js"
rollback() {
  trap - ERR
  echo "Activation failed; restoring previous application and MCP bundle." >&2
  ln -sfn "${OLD_RELEASE}" "${APP_ROOT}/current"
  rsync -a --delete "${OLD_RELEASE}/apps/web/dist/" "${WEB_ROOT}/"
  cp "${BACKUP_DIR}/mcp.bundle.js" /opt/bodydashboard-mcp/server.bundle.js
  systemctl restart bodydashboard-api bodydashboard-mcp
  exit 1
}
trap rollback ERR

cd "${RELEASE_DIR}/apps/api"
npx prisma migrate deploy
npx tsx prisma/initialize-production.ts
chown -R "${APP_USER}:${APP_USER}" "${DATA_ROOT}"

ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"
chown -h "${APP_USER}:${APP_USER}" "${APP_ROOT}/current"

mkdir -p "${WEB_ROOT}"
rsync -a --delete "${RELEASE_DIR}/apps/web/dist/" "${WEB_ROOT}/"
chown -R "${APP_USER}:${APP_USER}" "${WEB_ROOT}"

systemctl restart bodydashboard-api
systemctl reload apache2
for attempt in $(seq 1 20); do
  if curl --fail --silent http://127.0.0.1:4000/api/health >/dev/null; then break; fi
  sleep 1
done
curl --fail --silent http://127.0.0.1:4000/api/health >/dev/null
install -o "${APP_USER}" -g "${APP_USER}" -m 644 "${RELEASE_DIR}/apps/mcp/dist/server.bundle.js" /opt/bodydashboard-mcp/server.bundle.js
systemctl restart bodydashboard-mcp
# Probe the secret endpoint without printing or exposing its URL in process arguments.
python3 - <<'PY'
import json, time, urllib.request
settings = {}
for line in open('/etc/bodydashboard-mcp.env'):
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.strip().split('=', 1)
        settings[key] = value.strip('\"\'')
url = 'http://127.0.0.1:' + settings.get('PORT', '4001') + '/mcp/' + settings['MCP_PATH_SECRET']
payload = json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/list','params':{}}).encode()
for attempt in range(20):
    try:
        request = urllib.request.Request(url, data=payload, headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.load(response)
        assert 'supplement_get' in {tool['name'] for tool in data['result']['tools']}
        break
    except Exception:
        if attempt == 19:
            raise SystemExit('MCP health verification failed')
        time.sleep(1)
PY
trap - ERR

find "${APP_ROOT}/releases" -mindepth 1 -maxdepth 1 -type d | sort | head -n -5 | xargs -r rm -rf

echo "Bodydashboard release ${RELEASE_ID} deployed."
