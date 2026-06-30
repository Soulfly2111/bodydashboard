# Bodydashboard

Moderne, responsive Webanwendung zum Tracken von Ernährung, Makronährstoffen, Wasser, Gewicht, Rezepten und Zielen.

## Stack

- Frontend: React, TypeScript, TailwindCSS, Lucide React, Recharts, Vite
- Backend: Node.js, Express, TypeScript, REST API
- Datenbank: SQLite mit Prisma, einfach auf PostgreSQL umstellbar
- Authentifizierung: JWT
- PWA-ready mit Offline-Fallback und Service Worker
- Import-Framework mit Atlassian Confluence REST API als erster Datenquelle

## Start

```bash
cd bodydashboard
npm install
cp apps/api/.env.example apps/api/.env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000/api/health

Demo-Login:

- E-Mail: `demo@example.com`
- Passwort: `DemoPassword123!`

## Wichtige Skripte

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run db:migrate
npm run db:seed
```

Falls `prisma migrate dev` auf einer Windows-Maschine ohne Detailausgabe mit `Schema engine error` abbricht, ist die erzeugte SQL-Initialmigration unter `apps/api/prisma/migrations/20260630134500_init/migration.sql` eingecheckt. Das Schema selbst lässt sich mit `npx prisma validate` prüfen; die Migration kann dann auch direkt gegen SQLite angewendet werden.

## Deployment

Der Produktionsprozess für [`Soulfly2111/bodydashboard`](https://github.com/Soulfly2111/bodydashboard) und den Server `185.207.107.160` liegt in [DEPLOYMENT.md](./DEPLOYMENT.md). Enthalten sind GitHub Actions, Server-Bootstrap, systemd-Service und Nginx-Konfiguration.

## Architektur

```text
apps/
  api/
    prisma/
      schema.prisma
      seed.ts
    src/
      config/
      middleware/
      modules/
      repositories/
      services/
      utils/
  web/
    src/
      components/
      hooks/
      lib/
      pages/
      types/
```

Backend-Module sind nach Fachdomänen getrennt. Datenzugriff läuft über Repository-Klassen, damit SQLite später ohne API-Bruch auf PostgreSQL migriert werden kann. Der Importbereich nutzt `ImportSourceProvider`, `ImportMapper` und `ImportService`; Confluence ist nur eine Provider-Implementierung.

## Confluence-Import

In den Einstellungen können mehrere Quellen konfiguriert werden:

- Base URL
- Space Key
- Seitentitel oder Page ID
- Benutzer/E-Mail
- API Token oder Personal Access Token
- Spaltenmapping
- Sync-Modus

Credentials werden serverseitig verschlüsselt gespeichert. Die Vorschau ruft Confluence-Seiten ab, extrahiert Tabellen, wendet gespeicherte Mappings an und zeigt Konflikte vor dem Import. Unterstützt sind Import-only, Upsert, optionales Löschen fehlender Datensätze und Änderungssync seit dem letzten Import.

## PostgreSQL-Wechsel

In `apps/api/prisma/schema.prisma` den Provider ändern:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Danach `DATABASE_URL` setzen und Migration ausführen.

## API-Überblick

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/foods`
- `POST /api/foods`
- `PUT /api/foods/:id`
- `DELETE /api/foods/:id`
- `GET /api/meals/day/:date`
- `POST /api/meals/items`
- `DELETE /api/meals/items/:id`
- `GET /api/recipes`
- `POST /api/recipes`
- `GET /api/weight`
- `POST /api/weight`
- `GET /api/water`
- `POST /api/water`
- `GET /api/goals`
- `PUT /api/goals`
- `GET /api/stats/day/:date`
- `GET /api/stats/week`
- `GET /api/import-sources`
- `POST /api/import-sources`
- `POST /api/import-sources/:id/preview`
- `POST /api/import-sources/:id/run`
- `GET /api/import-sources/:id/logs`

## Qualität

- Validierung mit Zod
- Fehler-Middleware und strukturierte Logger
- Optimistische Frontend-Updates vorbereitet
- Lazy Loading und Code Splitting über React Router
- Unit Tests mit Vitest
- E2E-Skelett mit Playwright
- Undo beim Löschen über Toast-Aktion vorbereitet
