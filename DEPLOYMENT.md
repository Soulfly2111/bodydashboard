# Bodydashboard Deployment

Ziel: Deployment von GitHub [`Soulfly2111/bodydashboard`](https://github.com/Soulfly2111/bodydashboard) auf den Server `185.207.107.160`.

## Architektur

- Nginx serviert das React-Frontend aus `/opt/bodydashboard/current/apps/web/dist`.
- Nginx proxyt `/api/*` an die lokale Express API auf `127.0.0.1:4000`.
- Die API läuft als systemd-Service `bodydashboard-api`.
- SQLite liegt persistent unter `/var/lib/bodydashboard/bodydashboard.db`.
- Releases liegen versioniert unter `/opt/bodydashboard/releases/<timestamp>`.

## Einmaliges Server-Bootstrap

Auf dem Server als `root`:

```bash
git clone https://github.com/Soulfly2111/bodydashboard.git /tmp/bodydashboard-bootstrap
cd /tmp/bodydashboard-bootstrap
bash deploy/server/bootstrap-server.sh
nano /etc/bodydashboard/bodydashboard.env
```

Setze in `/etc/bodydashboard/bodydashboard.env` mindestens:

```bash
NODE_ENV=production
PORT=4000
WEB_ORIGIN=http://185.207.107.160
DATABASE_URL=file:/var/lib/bodydashboard/bodydashboard.db
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<32-plus-random-characters>
```

Danach:

```bash
systemctl daemon-reload
systemctl status nginx
```

## GitHub Secrets

Im Repository `Soulfly2111/bodydashboard` unter Settings -> Secrets and variables -> Actions:

- `DEPLOY_HOST`: `185.207.107.160`
- `DEPLOY_USER`: SSH-Benutzer mit sudo-Rechten
- `DEPLOY_SSH_KEY`: privater SSH-Key für diesen Benutzer
- `DEPLOY_PORT`: optional, Standard ist `22`

Der Benutzer muss `sudo /opt/bodydashboard/deploy/deploy-release.sh ...` ausführen dürfen.

## Deployment

Automatisch:

```bash
git push origin main
```

Manuell:

GitHub -> Actions -> Deploy Bodydashboard -> Run workflow.

## Rollback

Auf dem Server:

```bash
ls -1 /opt/bodydashboard/releases
ln -sfn /opt/bodydashboard/releases/<release-id> /opt/bodydashboard/current
systemctl restart bodydashboard-api
systemctl reload nginx
```

## Logs

```bash
journalctl -u bodydashboard-api -f
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
