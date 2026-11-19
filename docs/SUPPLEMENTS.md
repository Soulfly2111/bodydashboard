# Supplements and macro overview

The login landing page `/` shows seven local calendar days and four consecutive
seven-day periods ending today. The original widgets remain at `/dashboard-details`.
`/supplements` manages user-owned products, archives and dated intakes.

The API uses the user's configured timezone (default Europe/Berlin). Existing
date-only health records at UTC midnight retain their stored calendar date;
timestamped records are grouped in the user's timezone. Nutrition averages always
divide by seven; weight and body-fat averages only use days with measurements.
Multiple measurements are averaged within a day first. An intake on any one day
lights the daily supplement indicator; weekly indicators count distinct intake days.
Any activity lights the sport indicator, including walking.

## REST

JWT routes live under `/api/supplements`. The integration uses identical routes
under `/api/integrations/openclaw/supplements`, with an API key and scopes
`supplements:read` / `supplements:write` (or `*`). Scoped bearer API keys are checked
on the JWT routes too. Legacy OpenClaw keys previously had implicit wildcard
permissions: the migration preserves those effective rights explicitly, while
newly issued keys respect their actual scopes.

- `GET /`: active products; `?archived=true` includes archived products, `q` filters names.
- `POST /`: create a product. Required: `name`, `unit` (`g`, `ml`, `Stück`).
- `GET /:id`: product and intake history; optional `from` / `to` dates.
- `PATCH /:id`: edit, archive or restore. Unit cannot change after first intake.
- `POST /:id/entries`: positive `amount`, optional local `date` (`YYYY-MM-DD`),
  `unit` and `externalId`. Date defaults to today in the user timezone.
- `PATCH /:id/entries/:entryId`: correct amount or date without replacing nutrients.
- `DELETE /:id/entries/:entryId`: remove one intake.

Nutrients (`calories`, `protein`, `fat`, `carbs`) are optional per 100 base units.
Null is unknown; zero is a known zero. Intakes snapshot these values, so changing
a product does not rewrite history. Reusing `externalId` with different data
returns 409; an identical retry returns the existing intake.

`GET /api/stats/overview?end=YYYY-MM-DD` returns days, weeks and the supplement
legend. `end` is optional. Rows include `hasNutrition`, `knownNutrition`, and
`missingNutritionCount` so clients can distinguish no records, unknown nutrition
and actual zero values. Supplement calories/macros are also included in existing
day/week statistics, without generating meal records or reclassifying old foods.

## Production

The additive migration adds products and intakes. `initialize-production.ts`
idempotently creates Creatin, Kollagen and LaVita for existing users, with no dose
or nutrient assumptions and no fabricated intakes. New users receive the same
defaults at account creation. Demo seed is no longer run during deployment.

Deployment backs up SQLite through its online backup API and saves the existing
MCP bundle in `/opt/bodydashboard/backups/<release>/`. API and web activate before
the new MCP bundle. A failed activation restores the old application and bundle;
the additive database migration is retained. Database restore is a separate
recovery action, because restoring it could discard subsequent user writes.
Keep backups root-only. No production credentials or endpoint secrets belong in Git.
