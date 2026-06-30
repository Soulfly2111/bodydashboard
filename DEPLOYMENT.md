# Bodydashboard Deployment

Ziel: Deployment von GitHub [`Soulfly2111/bodydashboard`](https://github.com/Soulfly2111/bodydashboard) auf `bodydashboard.de` mit bestehendem Apache-VHost und Webroot `/etc/www/bodydashboard`.

## Architektur

- Apache bleibt der öffentliche Webserver.
- Apache serviert das React-Frontend direkt unter `https://bodydashboard.de/` aus `/etc/www/bodydashboard`.
- Apache proxyt `/api/*` an die lokale Express API auf `127.0.0.1:4000/api/*`.
- Die API läuft als systemd-Service `bodydashboard-api`.
- SQLite liegt persistent unter `/var/lib/bodydashboard/bodydashboard.db`.
- Releases liegen versioniert unter `/opt/bodydashboard/releases/<timestamp>`.

## Apache-VHost

Wenn `/etc/apache2/sites-available/bodydashboard.conf` noch nicht existiert, installiert der Bootstrap diese Site-Konfiguration. Wenn dein VHost bereits existiert, bleibt er unverändert; übernimm dann mindestens die folgenden Blöcke:

```apache
<VirtualHost *:80>
    ServerName bodydashboard.de
    ServerAlias www.bodydashboard.de

    DocumentRoot /etc/www/bodydashboard

    <Directory /etc/www/bodydashboard>
        Options FollowSymLinks
        AllowOverride None
        Require all granted
        FallbackResource /index.html
    </Directory>

    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:4000/api/
    ProxyPassReverse /api/ http://127.0.0.1:4000/api/
</VirtualHost>
```

Wenn du bereits einen eigenen VHost hast, übernimm mindestens `DocumentRoot`, `Directory`, `ProxyPass` und `ProxyPassReverse` daraus.

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
WEB_ORIGIN=https://bodydashboard.de
DATABASE_URL=file:/var/lib/bodydashboard/bodydashboard.db
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<32-plus-random-characters>
```

Wenn HTTPS noch nicht aktiv ist, nutze vorübergehend:

```bash
WEB_ORIGIN=http://bodydashboard.de
```

Danach:

```bash
apachectl configtest
systemctl reload apache2
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

## Prüfen

```bash
systemctl status bodydashboard-api --no-pager
journalctl -u bodydashboard-api -f
apachectl configtest
curl -I http://bodydashboard.de/
curl http://bodydashboard.de/api/health
```

## Rollback

Auf dem Server:

```bash
ls -1 /opt/bodydashboard/releases
ln -sfn /opt/bodydashboard/releases/<release-id> /opt/bodydashboard/current
rsync -a --delete /opt/bodydashboard/current/apps/web/dist/ /etc/www/bodydashboard/
systemctl restart bodydashboard-api
systemctl reload apache2
```

## Logs

```bash
journalctl -u bodydashboard-api -f
tail -f /var/log/apache2/bodydashboard_access.log
tail -f /var/log/apache2/bodydashboard_error.log
```
