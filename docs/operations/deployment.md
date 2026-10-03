# Deployment and operations

## Overview

```text
pull request ──► CI (backend, frontend, e2e, image)
push to main ──► CI ──success──► Deploy staging (build image once, push, deploy by digest, record digest)
manual        ──► Promote to production (approval) ──► deploy the digest staging recorded
```

- One image (`Dockerfile`, target `production`) runs every process: web
  (FrankenPHP/Caddy), Horizon, the scheduler and Reverb.
- Images are pushed to GHCR as `ghcr.io/<owner>/<repo>:<commit-sha>` and are
  always deployed by digest (`ghcr.io/<owner>/<repo>@sha256:...`).
- Production never builds. It redeploys the exact digest that a successful
  staging deploy recorded for the same commit.

## Continuous integration (`.github/workflows/ci.yml`)

Runs on every pull request and on every push to `main`. Jobs:

| Job        | What it runs                                                                 |
| ---------- | ---------------------------------------------------------------------------- |
| `backend`  | `composer lint`, `composer analyse`, `composer test` (real PostgreSQL 17 and Redis 8; migrations run from an empty database) |
| `frontend` | `npm run lint`, `format:check`, `types`, `test`, `build`                     |
| `e2e`      | Builds the Compose stack (with `compose.ci.yaml`: prebuilt assets, no Vite server), migrates, runs `php artisan foundation:smoke`, then `npm run test:e2e` |
| `image`    | Builds the production image                                                  |

Branch protection is configured in GitHub, not in code: in the repository
settings, protect `main` and mark `backend`, `frontend`, `e2e` and `image` as
required status checks.

## Server setup (once per environment)

1. Install Docker Engine and Docker Compose >= 2.30. Create a deploy user in
   the `docker` group and add the deploy public key to its
   `~/.ssh/authorized_keys`.
2. Create the deploy directory (default `/opt/rinquo`) owned by the deploy user.
3. Write `/opt/rinquo/app.env` with every variable from
   [environments.md](environments.md) for that environment, then
   `chmod 600 app.env`. This file exists only on the server.
4. Point DNS for the app hostname at the server and set `SERVER_NAME` to that
   hostname. Caddy obtains and renews the certificate; certificates are kept in
   the `caddy-data` volume, so redeploys do not re-issue them.
5. Configure the GitHub environment secrets and variables (see
   [environments.md](environments.md#github-configuration)).

## Staging deploys (`.github/workflows/deploy-staging.yml`)

Triggered only when the `CI` workflow completes successfully for a push to
`main`. It:

1. checks out the commit CI validated;
2. builds the production image and pushes `ghcr.io/<owner>/<repo>:<sha>`;
3. copies `deploy/compose.production.yaml` and `deploy/deploy.sh` to the server;
4. runs `deploy.sh <image@digest>` over SSH (see below);
5. uploads a `release-<sha>` artifact containing the deployed digest
   (kept 90 days). Production promotion reads this record.

Only one staging deploy runs at a time; a later one waits instead of
cancelling an in-progress deploy.

## Production promotion (`.github/workflows/promote-production.yml`)

1. In GitHub Actions, run "Promote to production" with the full commit SHA that
   is already on staging.
2. A required reviewer of the `production` environment approves the job.
3. The workflow finds the successful "Deploy staging <sha>" run, reads its
   `release-<sha>` digest, confirms the image exists in GHCR, and runs the same
   `deploy.sh` with that digest. It fails if staging never deployed that commit
   successfully.

## What `deploy.sh` does

```text
lock ─► record current image ─► pull new image ─► migrate (one-off container, new image)
     ─► switch web/horizon/scheduler/reverb ─► poll RINQUO_READY_URL ─► done
                                               └─ not ready ─► switch back to previous image, exit 1
```

- A failed pull or migration exits non-zero before any running service is
  touched: the previous release keeps serving.
- If the new release does not report ready within `RINQUO_READY_TIMEOUT`
  (default 120s), the script redeploys the previous image and exits non-zero,
  so the workflow fails.
- Each container caches config, routes, views and events on start. A missing
  required variable stops the container with the missing key names, which
  shows up as a failed readiness check and triggers the rollback.
- The web container is recreated during the switch, so expect a few seconds
  of unavailability per deploy (single VPS, no blue/green).
- Horizon receives SIGTERM and finishes running jobs (grace period 70s).

### Migrations must be backward compatible

Rollback never reverses migrations. The previous release must keep working on
the new schema, so use expand/contract:

1. Expand: add new tables/columns (nullable or with defaults); keep old ones.
2. Deploy code that writes both and reads the new structure.
3. Contract: drop old columns/tables in a later release.

Never rename or drop a column that the currently deployed release still uses.

## Rollback to a previous release

To roll back to an earlier commit that staging deployed:

- Production: run "Promote to production" with that earlier commit SHA.
- Either environment, manually on the server:

  ```bash
  cd /opt/rinquo
  RINQUO_READY_URL=https://<host>/ready ./deploy.sh ghcr.io/<owner>/<repo>@sha256:<digest>
  ```

  The digest of each release is in the `release-<sha>` artifact of its staging
  run, and the currently deployed image is in `/opt/rinquo/.current-image`.

Migrations already applied stay applied (see above).

## Failed migration handling

1. `deploy.sh` exits during the migration step; services still run the
   previous image. Read the error in the workflow log.
2. PostgreSQL runs each migration in a transaction, so a failed migration
   normally leaves no partial change. Confirm with
   `docker compose -f compose.production.yaml run --rm --no-deps web php artisan migrate:status`
   (set `RINQUO_IMAGE` to the current image).
3. Fix the migration in a new commit and let it flow through CI and staging
   again. Do not edit migrations that already ran in production.
4. If data was damaged, restore with the managed provider's point-in-time
   recovery to a new instance, verify it, then point `DB_HOST` at it.

## Staging recovery

- Redeploy the last known good release with `deploy.sh` and its digest
  (above).
- Check processes: `RINQUO_IMAGE=$(cat .current-image) docker compose -f compose.production.yaml ps`
  and `... logs --tail 200 <service>`.
- Failed jobs: `docker compose ... exec horizon php artisan queue:failed`,
  retry with `queue:retry <id>`. (The Horizon dashboard is disabled outside
  local until platform administration exists.)
- Full health check: `docker compose ... exec web php artisan foundation:smoke`
  (`--mail-to=` only with a Resend test address).
- Database: restore staging from a managed backup or re-create it empty and
  run the deploy again (migrations run from an empty database).

## Local recovery

See [README.md](../../README.md#local-recovery). `make reset` removes all
local data and sets the stack up again.

## Local deploy rehearsal

`deploy.sh` can be rehearsed on a workstation with a locally built image:

```bash
docker build --target production -t rinquo:local-release .
mkdir -p /tmp/rinquo-deploy && cp deploy/compose.production.yaml deploy/deploy.sh /tmp/rinquo-deploy/
# write /tmp/rinquo-deploy/app.env (APP_ENV=production, SERVER_NAME=:80, APP_URL=http://localhost:8088, ...)
cd /tmp/rinquo-deploy
RINQUO_COMPOSE_PROJECT=rinquo-rehearsal RINQUO_HTTP_PORT=8088 RINQUO_HTTPS_PORT=8443 \
RINQUO_SKIP_PULL=1 RINQUO_READY_URL=http://localhost:8088/ready ./deploy.sh rinquo:local-release
```

To use the dev stack's PostgreSQL/Redis/RustFS as stand-ins, attach the
services to the `rinquo_default` network with an override file passed as
`RINQUO_COMPOSE_EXTRA_FILE`. In that case set `REVERB_HOST` and
`REVERB_UPSTREAM` to the rehearsal Reverb container name: the `reverb`
service name would otherwise also resolve to the dev Reverb container.

## Observability

- **Structured logs.** Staging and production log JSON to stderr
  (`docker compose logs`). Every request gets an `X-Request-Id` (an incoming
  id is reused only if it matches `^[A-Za-z0-9._-]{1,64}$`), recorded as
  `extra.request_id` on every log entry and carried into queued jobs. Request
  bodies, tokens, OTPs and environment values are never logged.
- **Error tracking.** Not yet chosen. Integration point:
  `->withExceptions()` in `bootstrap/app.php` (add the provider's
  `$exceptions->report(...)` or its Laravel integration there) plus its DSN as
  an environment variable. Until then, reported exceptions appear in the JSON
  log stream. Choose a provider before production go-live.
- **Uptime monitoring.** Point the external monitor at
  `https://<host>/up` (liveness: the app boots) and `https://<host>/ready`
  (readiness: `200` with `{"status":"ok",...}`, or `503` when PostgreSQL or
  Redis is unavailable). Responses never include hosts, credentials or
  exception details. Alert on `/ready` failures and on certificate expiry.
- **Queues.** Horizon metrics snapshots are scheduled every five minutes.
  Failed jobs stay in the `failed_jobs` table (`queue:failed`).
