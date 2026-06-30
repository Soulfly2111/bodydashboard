# Bodydashboard Deployment

Ziel: Deployment von GitHub [`Soulfly2111/bodydashboard`](https://github.com/Soulfly2111/bodydashboard) auf den Server `185.207.107.160` mit bestehendem Apache.

## Architektur

- Apache bleibt auf Port `80`.
- Apache serviert das React-Frontend unter `/bodydashboard/` aus `/opt/bodydashboard/current/apps/web/dist`.
- Apache proxyt `/bodydashboard/api/*` an die lokale Express API auf `127.0.0.1:4000/api/*`.
- Die API läuft als systemd-Service `bodydashboard-api`.
- SQLite liegt persistent unter `/var/lib/bodydashboard/bodydashboard.db`.
- Releases liegen versioniert unter `/opt/bodydashboard/releases/<timestamp>`.

## Einmaliges Server-Bootstrap

Auf dem Server als `root`:

```bash
cd /tmp
rm -rf bodydashboard-bootstrap
git clone -b main https://github.com/Soulfly2111/bodydashboard.git /tmp/bodydashboard-bootstrap
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
apachectl configtest
systemctl reload apache2
```

Die App ist nach erfolgreichem Deployment erreichbar unter:

```text
http://185.207.107.160/bodydashboard/
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
systemctl reload apache2
```

## Logs

```bash
journalctl -u bodydashboard-api -f
tail -f /var/log/apache2/access.log
tail -f /var/log/apache2/error.log
```

## Apache-Konfiguration prüfen

```bash
apachectl configtest
apache2ctl -M | grep -E 'proxy|rewrite|headers'
cat /etc/apache2/conf-enabled/bodydashboard.conf
```
