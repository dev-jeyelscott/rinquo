# Monitoring and error tracking

Logs, error tracking, uptime checks and the failed-job queue are different
controls. A passing `/ready` check is not proof that backups are recoverable
(see [backup-and-recovery.md](backup-and-recovery.md)).

## Sentry Cloud (error tracking)

Approved contract (task `08-platform-admin-and-operational-recovery`):

| Topic | Rule |
| ----- | ---- |
| Projects | Two Sentry Cloud projects per environment: **backend** (Laravel SDK) and **browser** (React SDK). Staging and production only; local and CI have no DSN, which disables both SDKs. |
| DSNs | `SENTRY_LARAVEL_DSN` (backend project) and `SENTRY_BROWSER_DSN` (browser project) in each server's `app.env`. A browser DSN is a public identifier; it is still not committed. |
| Release | One immutable id: the **commit SHA**, baked into the image as `SENTRY_RELEASE` at build time. Backend reports, browser reports and the uploaded source maps all carry it. Production promotes the same digest, so it reports the same release staging verified. |
| Retention | Set the project data-retention to **30 days** (Sentry project settings; not enforceable from code). Session replay stays off (it is never initialised). Default PII and IP collection stay off. |
| Metadata allowed | release, environment, route template (backend) or Inertia component (browser), exception class, job class, an opaque correlation id (the `X-Request-Id`). |
| Never sent | request bodies, query strings, cookies, auth headers, users, breadcrumbs, extra data, contexts, passwords, passkeys or OTP/recovery codes, provider payloads, private object URLs, customer PII, raw SQL and **every exception message** (replaced by `[message withheld]`). |
| Failure mode | A Sentry outage or a scrubber error drops the event and never changes the response: the scrubber catches its own errors and the SDK sends out of band. |

How it is enforced in code:

- Backend: `config/sentry.php` turns off tracing, logs, metrics and breadcrumbs
  and sets `before_send` to `App\Support\Telemetry\ErrorScrubber`, which builds
  a new event from an allowlist instead of removing known-bad fields.
- Browser: `resources/js/lib/telemetry.ts` initialises only the global error
  handlers and rebuilds each event from an allowlist (`scrubBrowserEvent`).
- Tests: `tests/Unit/ErrorScrubberTest.php` and
  `resources/js/lib/telemetry.test.ts` feed events full of secrets, PII, SQL and
  private URLs through the scrubbers and assert nothing survives. Never use
  production customer data as a telemetry fixture.

### Source maps

The production image build (`Dockerfile`, stage `assets`) runs only for
releases that have the `sentry_auth_token` BuildKit secret and a
`SENTRY_RELEASE`:

1. build with hidden source maps (`SOURCEMAP=hidden`);
2. `sentry-cli sourcemaps inject` then `upload --release <sha>` to the browser project;
3. delete every `*.map` file; the stage fails if any remain.

The auth token exists only in that `RUN` secret mount, as a GitHub environment
secret (`SENTRY_AUTH_TOKEN`, scope: release/source-map upload for the browser
project). It is never an `ARG`, `ENV`, image layer, runtime variable or log
line. `deploy-staging.yml` refuses to build without it, then verifies the pushed
image contains no `.map` files and that its `SENTRY_RELEASE` equals the commit.
Pull-request and local builds have no secret and ship no maps.

GitHub configuration: secret `SENTRY_AUTH_TOKEN`, variables `SENTRY_ORG` and
`SENTRY_BROWSER_PROJECT`, on the `staging` environment.

### Alerts and ownership

- Urgent production alerts (a new issue, an issue regressing, or a spike) go to
  the **operations email**; the **platform operator** owns triage. Record the
  Sentry alert rules and the recipient list in the operations ticket tracker
  with a date when they are created or changed.
- Pair Sentry with the external uptime monitor (below): Sentry sees exceptions,
  the monitor sees outages where no exception is raised.

### Staging verification (before the first production deploy, and after any SDK or scrubber change)

1. Deploy the release to staging through the normal workflow.
2. **Backend:** on the staging server run
   `docker compose -f compose.production.yaml exec web php artisan platform:verify-telemetry`.
   It sends one `TelemetryVerificationException` whose message contains a canary
   secret. In the **backend** project confirm the event arrived, the release is
   the commit SHA, the environment is `staging`, the `route`/`correlation_id`
   tags are present, and the text `canary-secret` appears nowhere on the event.
3. **Browser:** open the staging site, run in the devtools console
   `setTimeout(() => { throw new Error('rinquo-staging-verification canary-secret') })`.
   In the **browser** project confirm the event arrived with the release, the
   error shows a symbolicated stack (source maps matched), the message reads
   `[message withheld]`, and no URL query, user, cookie or breadcrumb is present.
4. Attach the confirmation (date, operator, event ids) to the release ticket.

The command refuses to run in production: production is verified by the staging
run of the same release.

## Uptime and certificates

Point an external monitor at:

- `https://<host>/up`: liveness (the app boots).
- `https://<host>/ready`: readiness, `200` with `{"status":"ok",...}`, `503`
  when PostgreSQL or Redis is unavailable. It never includes hosts, credentials
  or exception details.

Alert on `/ready` failures and on certificate expiry (Caddy renews
automatically; the alert catches a renewal failure). Record the monitor
account, the alert recipients and the expected status/body in the ticket
tracker. Verify the alert works in staging by stopping `web` or `redis`
briefly and confirming the notification and the recovery message.

## Queues and failed jobs

- Horizon metrics snapshots run every five minutes. The Horizon dashboard stays
  disabled outside local development.
- Failed jobs stay in the `failed_jobs` table. Platform administrators see a
  redacted list at `/platform/failed-jobs` (class, queue, exception class and
  time only; never payloads or messages) and can retry **one job at a time**,
  only for job classes listed in `config/rinquo.php` → `platform.retryable_jobs`
  (jobs proven safe to run again). Retry needs password plus authenticator code,
  is audited, and records the retry in `platform_job_retries`. Everything else
  is retried by an operator only after reading its runbook entry.
- Alert on queue wait and failure growth with the provider's mechanism you use
  for uptime (for example a heartbeat on a scheduled `queue:failed` count).
  The overview page shows the failed-job count; it reflects the retained table,
  not live queue health.
