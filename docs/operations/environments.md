# Environments

Rinquo runs the same application image in three environments. Configuration
comes only from environment variables:

| Environment | Where values live                                           |
| ----------- | ----------------------------------------------------------- |
| Development | `.env` (copied from `.env.example`, gitignored)              |
| Staging     | `app.env` in the deploy directory on the staging server      |
| Production  | `app.env` in the deploy directory on the production server   |

Secrets never go into the repository, workflows, images or logs. Examples below
are placeholders, never real values.

## Differences between environments

| Concern          | Development                  | Staging                              | Production                  |
| ---------------- | ---------------------------- | ------------------------------------ | --------------------------- |
| `APP_ENV`        | `local`                      | `staging`                            | `production`                |
| `APP_DEBUG`      | `true`                       | `false`                              | `false`                     |
| PostgreSQL       | `pgsql` container            | managed                              | managed, with PITR          |
| Redis            | `redis` container            | managed                              | managed                     |
| Object storage   | RustFS container             | S3-compatible bucket (staging only)  | S3-compatible bucket        |
| Mail             | Mailtrap sandbox (SMTP)      | Resend, staging-only key, test addresses only | Resend             |
| Logs             | file (`storage/logs`)        | JSON on stderr                       | JSON on stderr              |
| TLS              | none (plain HTTP)            | automatic (Caddy, Let's Encrypt)     | automatic                   |
| Session cookie   | not `Secure` (HTTP)          | `Secure`                             | `Secure`                    |
| Horizon UI       | allowed                      | denied                               | denied                      |

In `staging` and `production` the application refuses to boot when required
values are missing and names the missing config keys (never their values).
Required: `APP_KEY`, `APP_URL`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`,
`REDIS_HOST`, `AWS_BUCKET`, `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`,
`MAIL_MAILER`, `RESEND_API_KEY` (when `MAIL_MAILER=resend`), `REVERB_APP_ID`,
`REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PUBLIC_HOST`.

## Variables

"Req." lists the environments where the variable must be set; otherwise the
default applies.

### Application

| Variable               | Purpose                                                         | Req.        | Safe example |
| ---------------------- | --------------------------------------------------------------- | ----------- | ------------ |
| `APP_NAME`             | Product name shown in the UI and mail                           | -           | `Rinquo` |
| `APP_ENV`              | `local`, `staging` or `production`                              | all         | `production` |
| `APP_KEY`              | Encryption key (`php artisan key:generate --show`); unique per environment | all | `base64:...` |
| `APP_DEBUG`            | Never `true` outside development                                | all         | `false` |
| `APP_URL`              | Public base URL; also the trusted host outside local            | all         | `https://staging.rinquo.example` |
| `APP_DISPLAY_TIMEZONE` | Display timezone only; storage is always UTC                    | -           | `Asia/Manila` |
| `TRUSTED_PROXIES`      | Comma-separated proxy IPs/CIDRs whose `X-Forwarded-*` headers are trusted; empty trusts none | - | `10.0.0.0/8` |
| `SERVER_NAME`          | Caddy site address. A hostname enables automatic HTTPS; `:80` serves plain HTTP | staging, production | `staging.rinquo.example` |
| `APP_MAINTENANCE_DRIVER` | Maintenance mode store                                        | -           | `file` |

### Logging

| Variable               | Purpose                                     | Req.                | Safe example |
| ---------------------- | ------------------------------------------- | ------------------- | ------------ |
| `LOG_CHANNEL`          | `stack` locally, `stderr` when deployed     | staging, production | `stderr` |
| `LOG_STDERR_FORMATTER` | JSON log lines when deployed                | staging, production | `Monolog\Formatter\JsonFormatter` |
| `LOG_LEVEL`            | Minimum level                               | -                   | `info` |
| `LOG_STACK`            | Channels for the local `stack` channel      | -                   | `single` |

Every log entry written during a request carries `extra.request_id`, which is
also returned in the `X-Request-Id` response header.

### PostgreSQL

| Variable             | Purpose                                         | Req. | Safe example |
| -------------------- | ----------------------------------------------- | ---- | ------------ |
| `DB_CONNECTION`      | Always `pgsql`                                  | all  | `pgsql` |
| `DB_HOST`, `DB_PORT` | Server                                          | all (host) | `db.internal`, `5432` |
| `DB_DATABASE`        | Database name                                   | all  | `rinquo` |
| `DB_USERNAME`, `DB_PASSWORD` | Least-privilege application role (owns the schema; no superuser) | all | `rinquo_app`, `<secret>` |
| `DB_SSLMODE`         | Use `require` (or stricter) for managed databases | -  | `require` |
| `DB_CONNECT_TIMEOUT` | Connect timeout in seconds                      | -    | `2` |
| `DB_URL`             | Optional DSN; if used, still set `DB_HOST`, `DB_DATABASE` and `DB_USERNAME` for the startup check | - | - |

The database session timezone is always UTC.

### Redis, cache, sessions, queues

| Variable                | Purpose                                         | Req. | Safe example |
| ----------------------- | ----------------------------------------------- | ---- | ------------ |
| `REDIS_HOST`, `REDIS_PORT` | Server                                       | all (host) | `redis.internal`, `6379` |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | Credentials (`null` when none)       | -    | `<secret>` |
| `REDIS_URL`             | Optional; use `rediss://...` for TLS. Still set `REDIS_HOST` | - | - |
| `REDIS_DB`, `REDIS_CACHE_DB` | Databases for queues/sessions and cache    | -    | `0`, `1` |
| `REDIS_PREFIX`, `HORIZON_PREFIX` | Key prefixes (change if a Redis is shared) | - | - |
| `REDIS_CONNECT_TIMEOUT`, `REDIS_READ_TIMEOUT` | Seconds                | -    | `1`, `2` |
| `CACHE_STORE`           | `redis`                                         | all  | `redis` |
| `SESSION_DRIVER`        | `redis`                                         | all  | `redis` |
| `SESSION_SECURE_COOKIE` | `true` when served over HTTPS                   | staging, production | `true` |
| `SESSION_HTTP_ONLY`, `SESSION_SAME_SITE` | Cookie flags (defaults `true`, `lax`) | - | `true`, `lax` |
| `SESSION_LIFETIME`, `SESSION_DOMAIN`, `SESSION_ENCRYPT` | Session tuning | - | `120`, `null`, `false` |
| `QUEUE_CONNECTION`      | `redis` (processed by Horizon)                  | all  | `redis` |
| `QUEUE_FAILED_DRIVER`   | Failed jobs stored durably in PostgreSQL        | -    | `database-uuids` |

### Object storage

| Variable                      | Purpose                                     | Req. | Safe example |
| ----------------------------- | ------------------------------------------- | ---- | ------------ |
| `FILESYSTEM_DISK`             | `s3` everywhere                             | all  | `s3` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Key limited to this bucket   | all  | `<key>`, `<secret>` |
| `AWS_DEFAULT_REGION`          | Bucket region                               | all  | `ap-southeast-1` |
| `AWS_BUCKET`                  | Private bucket, one per environment         | all  | `rinquo-staging` |
| `AWS_ENDPOINT`                | Endpoint for non-AWS providers              | -    | `https://<account>.r2.cloudflarestorage.com` |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` for the local emulator and some providers | - | `false` |
| `AWS_URL`                     | Optional public/CDN base URL                | -    | - |
| `RINQUO_MEDIA_DISK`           | Private disk for tenant logos and photos (defaults to `FILESYSTEM_DISK`) | - | `s3` |

### Owner sign-in throttles

| Variable                              | Purpose                                              | Req. | Safe example |
| ------------------------------------- | ---------------------------------------------------- | ---- | ------------ |
| `RINQUO_OTP_REQUESTS_PER_IP_PER_HOUR` | Sign-in code requests per IP per hour (default `20`) | -    | `20` |
| `RINQUO_OTP_VERIFY_PER_IP`            | Code verification attempts per IP per 10 minutes (default `20`) | - | `20` |
| `AWS_CONNECT_TIMEOUT`, `AWS_TIMEOUT` | Seconds                              | -    | `5`, `30` |

Files are private by default; storage failures throw (they are never silently
ignored).

### Mail

| Variable            | Purpose                                           | Req. | Safe example |
| ------------------- | ------------------------------------------------- | ---- | ------------ |
| `MAIL_MAILER`       | `smtp` (Mailtrap) in development, `resend` when deployed | all | `resend` |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SCHEME` | Mailtrap sandbox SMTP (development) | development | `sandbox.smtp.mailtrap.io`, `2525` |
| `MAIL_TIMEOUT`      | SMTP timeout in seconds                           | -    | `10` |
| `RESEND_API_KEY`    | Resend key; staging uses a separate, staging-only key | staging, production | `re_...` |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | Sender (a domain verified in Resend) | staging, production | `bookings@rinquo.example` |

### Realtime (Reverb)

| Variable               | Purpose                                                   | Req. | Safe example |
| ---------------------- | --------------------------------------------------------- | ---- | ------------ |
| `BROADCAST_CONNECTION` | `reverb`                                                  | all  | `reverb` |
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` | App credentials; the secret stays server-side | all | `rinquo`, `<random>`, `<secret>` |
| `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME` | Server-to-Reverb path (internal)   | all (host) | `reverb`, `8080`, `http` |
| `REVERB_SERVER_PORT`   | Port Reverb listens on inside its container               | -    | `8080` |
| `REVERB_PUBLIC_HOST`, `REVERB_PUBLIC_PORT`, `REVERB_PUBLIC_SCHEME` | What browsers connect to; shared at runtime, so one image serves every environment | all (host) | `staging.rinquo.example`, `443`, `https` |
| `REVERB_ALLOWED_ORIGINS` | Comma-separated hostnames allowed to open websockets     | staging, production | `staging.rinquo.example` |
| `REVERB_UPSTREAM`      | Where Caddy proxies `/app/*` and `/apps/*`                | -    | `reverb:8080` |
| `REVERB_CLIENT_CONNECT_TIMEOUT`, `REVERB_CLIENT_TIMEOUT` | Broadcast HTTP timeouts (seconds) | - | `3`, `5` |

### Local Docker only

| Variable                 | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `APP_PORT`, `VITE_PORT`  | Host ports for the app and the Vite server   |
| `HOST_UID`, `HOST_GID`   | Set by the Makefile so containers write files as you |

### Deploy script (`deploy/deploy.sh`)

| Variable                    | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `RINQUO_READY_URL`          | Required. Public `/ready` URL checked after switching       |
| `RINQUO_READY_TIMEOUT`      | Seconds to wait for readiness (default `120`)               |
| `RINQUO_APP_ENV_FILE`       | Application env file (default `./app.env`)                  |
| `RINQUO_COMPOSE_PROJECT`    | Compose project name (default `rinquo`)                     |
| `RINQUO_COMPOSE_EXTRA_FILE` | Optional host-specific Compose override                     |
| `RINQUO_HTTP_PORT`, `RINQUO_HTTPS_PORT` | Published ports (default `80`, `443`)           |
| `RINQUO_SKIP_PULL`          | `1` uses a local image (local rehearsal only)               |

## GitHub configuration

Create two GitHub Environments, `staging` and `production`.

| Name               | Kind     | Purpose                                                    |
| ------------------ | -------- | ---------------------------------------------------------- |
| `SSH_HOST`         | secret   | Server address                                             |
| `SSH_USER`         | secret   | Deploy user (member of the `docker` group, no sudo needed) |
| `SSH_PRIVATE_KEY`  | secret   | Private key of a deploy-only key pair                      |
| `SSH_KNOWN_HOSTS`  | secret   | Output of `ssh-keyscan <host>`, verified out of band       |
| `GHCR_PULL_TOKEN`  | secret   | Optional: read-only `read:packages` token if the image is private |
| `GHCR_PULL_USER`   | variable | Optional: user for `GHCR_PULL_TOKEN`                       |
| `APP_URL`          | variable | Public base URL (used for the readiness check)             |
| `DEPLOY_PATH`      | variable | Deploy directory on the server (default `/opt/rinquo`)     |

Production: add required reviewers to the `production` environment. Staging:
restrict the `staging` environment to the `main` branch.

## Required infrastructure

Per environment (staging and production are separate):

- One VPS with Docker Engine and Docker Compose >= 2.30, ports 80 and 443
  (TCP, plus UDP 443 for HTTP/3) open, and DNS for the app hostname pointing
  at it.
- Managed PostgreSQL 17 (production with point-in-time recovery), reachable
  only from the VPS.
- Managed Redis.
- A private S3-compatible bucket and a key limited to it.
- A Resend account with a verified sending domain (staging uses a separate key).
- An external uptime monitor and, before production go-live, an error-tracking
  provider (see [deployment.md](deployment.md#observability)).

The application does not interfere with database backups or PITR: it only
runs forward migrations and never touches backup configuration.
