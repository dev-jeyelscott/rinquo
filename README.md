# Rinquo

Rinquo is a multi-tenant booking platform built as a single Laravel modular
monolith (Inertia + React + TypeScript, PostgreSQL, Redis, Horizon, Reverb,
S3-compatible storage). The planning package lives in [`docs/`](docs/README.md);
the MVP roadmap is in [`docs/roadmaps/mvp/`](docs/roadmaps/mvp/master-roadmap.md).

This repository currently contains the foundation only (slice 00): no
business features yet.

## Requirements

- Docker Engine with Docker Compose v2 (the Docker stack is the supported
  development environment; no local PHP or Node is needed)
- GNU Make
- Free host ports `80` (app) and `5173` (Vite). Change them with `APP_PORT`
  and `VITE_PORT` in `.env` (if you change `APP_PORT`, also update `APP_URL`
  and `REVERB_PUBLIC_PORT`).

## Quick start

```bash
cp .env.example .env     # add your Mailtrap sandbox credentials if you need mail
make setup               # build images, install deps, app key, bucket, migrate
make up                  # start everything
```

Open <http://localhost>. Then check the foundation:

```bash
curl -i http://localhost/up       # liveness
curl -i http://localhost/ready    # readiness: PostgreSQL + Redis
make smoke                        # PostgreSQL, Redis, Horizon job, Reverb, S3
make smoke MAIL_TO=you@example.com  # also sends a Mailtrap smoke email
```

`make help` lists every target.

### Services (`compose.yaml`)

| Service     | Purpose                                                         |
| ----------- | --------------------------------------------------------------- |
| `app`       | FrankenPHP web server on <http://localhost> (plain HTTP)        |
| `vite`      | Vite dev server with HMR on port 5173                           |
| `horizon`   | Queue workers (dashboard at `/horizon`, local only)             |
| `scheduler` | `php artisan schedule:work`                                     |
| `reverb`    | Websocket server, proxied by `app` at `/app` and `/apps`        |
| `pgsql`     | PostgreSQL 17 (`rinquo` and `rinquo_testing` databases)         |
| `redis`     | Redis 8: cache, sessions, queues                                |
| `s3`        | RustFS, a local S3-compatible store; `s3-init` makes the bucket |

## Quality commands

The same scripts run locally and in GitHub Actions.

| What                          | Make (Docker)           | Underlying script                                                    |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------- |
| Install dependencies          | `make setup`            | `composer install`, `npm ci`                                         |
| Start / stop                  | `make up` / `make down` |                                                                      |
| Backend tests (Pest)          | `make test-backend`     | `composer test`                                                      |
| Frontend tests (Vitest + RTL) | `make test-frontend`    | `npm run test`                                                       |
| PHP lint / format             | `make lint`             | `composer lint` / `composer format`                                  |
| PHP static analysis           | `make analyse`          | `composer analyse` (Larastan)                                        |
| TS lint / format              | `make lint`             | `npm run lint`, `npm run format:check` (`lint:fix`, `format` to fix) |
| TypeScript check              | `make types`            | `npm run types`                                                      |
| Production asset build        | part of `make ci`       | `npm run build`                                                      |
| All non-E2E gates + build     | `make ci`               |                                                                      |
| Browser smoke tests           | `make e2e`              | `npm run test:e2e` (Playwright)                                      |

`make ci` and `make e2e` need the stack running (`make up`). `make e2e` runs
Playwright inside the official Playwright container against the running stack.

Backend tests run against real PostgreSQL (`rinquo_testing`) and Redis
(databases 14 and 15), never SQLite.

## Project layout

- `app/Modules/` - one folder per business domain, created by the slice that
  owns it (see [`app/Modules/README.md`](app/Modules/README.md)).
- `app/Support/` - cross-cutting code: logging (request ids), environment
  validation, diagnostics.
- `resources/js/` - Inertia pages, layouts, shadcn/ui components and helpers
  (`lib/datetime.ts` formats UTC instants in the display timezone).
- `tests/Feature`, `tests/Unit` (Pest), `resources/js/**/*.test.ts(x)`
  (Vitest), `tests/Browser` (Playwright).
- `docker/`, `compose.yaml`, `compose.ci.yaml`, `Dockerfile` - runtime.
- `deploy/` - staging/production Compose file and `deploy.sh`.

Time: everything is stored and processed in UTC; `Asia/Manila` is only the
display timezone (`APP_DISPLAY_TIMEZONE`).

## Local recovery

| Problem                                                     | Fix                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| Config, queue or Reverb code changes not picked up          | `make restart`                                            |
| Dependencies changed (`composer.lock`, `package-lock.json`) | `make setup`                                              |
| Database or volumes in a bad state                          | `make reset` (destroys local data, then sets up again)    |
| A service is unhealthy                                      | `docker compose ps`, then `docker compose logs <service>` |
| Port 80 or 5173 in use                                      | set `APP_PORT` / `VITE_PORT` in `.env`                    |

## Environments and deployment

- Environment variables: [`docs/operations/environments.md`](docs/operations/environments.md)
- CI, staging deploys, production promotion, rollback and recovery:
  [`docs/operations/deployment.md`](docs/operations/deployment.md)

Never commit `.env` files or secrets.
