# Bodydashboard MCP server

Source recovered on 2026-11-19 from the original local build directory and
verified against the running `/opt/bodydashboard-mcp/server.bundle.js` on the
production server. The application section of a fresh bundle matches the
production application section exactly. Production bundle SHA-256:

```text
898e29e861c3264f8884ccb99a970470ce60d870f7fff4e1936cd5f23388209c
```

This is a separate Node.js 20+ package, intentionally outside the root npm
workspaces. The production workflow also tests and builds this package. Deployment backs up the installed bundle, activates it after the API, and verifies the tool list.
Its lockfile preserves the recovered runtime dependency versions. Generated
bundles, credentials, production environment files and private keys are not
versioned.

## Build and test

From this directory:

```sh
npm ci
npm test
npm run build
```

The output is `dist/server.bundle.js`, including its runtime dependencies.
The tests use a local mock API, not production health data.

## Configuration

See `.env.example` for variable names. The server reads environment variables;
it does not automatically load `.env`. For local development with Node.js 20+:

```sh
node --env-file=.env server.js
```

`BODYDASH_API_KEY` authenticates the OpenClaw integration. Optional
`BODYDASH_EMAIL` and `BODYDASH_PASSWORD` enable JWT-backed reads and searches.
Do not copy production values into this repository.

The default transport is stdio. Set `BODYDASH_TRANSPORT=http` for stateless
Streamable HTTP, listening on `127.0.0.1:4001` (override with `PORT`). Before
using HTTP, set a long random `MCP_PATH_SECRET`; the existing implementation
does not reject an empty secret. The endpoint is `/mcp/<secret>` behind the
production HTTPS reverse proxy. Treat that full URL as a credential. The
existing HTTP startup log contains the URL, so restrict access to service logs.

## Existing production layout

- Bundle: `/opt/bodydashboard-mcp/server.bundle.js`
- Environment file: `/etc/bodydashboard-mcp.env`
- Service: `bodydashboard-mcp.service`, running as `bodydashboard`
- Unit template: `../../deploy/systemd/bodydashboard-mcp.service`

The service unit was copied from production. Apache's live MCP proxy mapping
is managed separately; it is not included because the path contains the secret.
Keep that mapping and the environment file when replacing the bundle. Protect
the environment file with root-only access (systemd reads it before switching
to the service user).

For an intentional MCP update, build and test locally, back up the installed
bundle, copy the new bundle to the existing path, then restart only
`bodydashboard-mcp`. Verify MCP initialization, `tools/list` and `bd_status`.
Rollback consists of restoring the previous bundle and restarting that service.
A push to main runs the combined production deployment unless CI is explicitly skipped.

## Tools

`bd_status`, `food_search`, `food_upsert`, `meal_log`, `meal_add_item`,
`meal_get_day`, `meal_update_item`, `meal_delete_item`, `off_search`,
`off_import`, `water_log`, `weight_log`, `activity_log`, `stats_day`,
`stats_week`.

## Supplement tools

`supplement_list`, `supplement_get`, `supplement_log`,
`supplement_update_entry`, `supplement_delete_entry` use the OpenClaw integration
with `supplements:read` / `supplements:write` scopes (or `*`). They work without
JWT login. Supply an ID or an unambiguous full name, and quantities in the stored
unit. `externalId` makes intake retries idempotent. Unknown nutrients are null.
