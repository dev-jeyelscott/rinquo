# Incident runbooks

Each entry: detect, contain, diagnose, recover, verify, escalate, evidence. Commands
run on the server in the deploy directory (default `/opt/rinquo`). Shorthand:

```bash
cd /opt/rinquo
export RINQUO_IMAGE="$(cat .current-image)"
dc() { docker compose -p rinquo -f compose.production.yaml "$@"; }
```

Services: `web` (FrankenPHP/Caddy), `horizon`, `scheduler`, `reverb`. PostgreSQL and Redis are
managed services outside Compose. **Never print `app.env`, tokens or connection strings** while
diagnosing; read variable names only. Record every incident in the ticket tracker with times,
actions, the release SHA and the Sentry issue links.

Verify after any recovery: `/ready` is `200`; `dc exec web php artisan foundation:smoke`;
`dc exec horizon php artisan horizon:status` is running; the failed-job count is not growing.

## App or release incident

- **Detect:** uptime monitor on `/up` or `/ready`; Sentry spike; failed `deploy.sh`.
- **Contain:** if a release is bad, roll back (below). Do not edit running containers.
- **Diagnose:** `dc ps`; `dc logs --tail 200 web` (JSON lines; search by the `X-Request-Id` a user reports); Sentry issue for the release SHA.
- **Recover:** roll back to the last good digest: `RINQUO_READY_URL=https://<host>/ready ./deploy.sh ghcr.io/<owner>/<repo>@sha256:<digest>` (or "Promote to production" with the earlier SHA). Migrations are forward-only and backward compatible, so the previous release runs on the new schema.
- **Escalate:** the platform operator owns triage; escalate to the incident commander if recovery exceeds the 4-hour RTO.
- **Evidence:** release SHAs before and after, deploy log, Sentry issues.

## Queue incident (Horizon, Redis, failed jobs)

- **Detect:** failed-job count on `/platform` rising; booking emails or webhook processing delayed; `/ready` `503` when Redis is down.
- **Contain:** nothing needs stopping for a few failed jobs. If Redis is unavailable, bookings still persist in PostgreSQL; sessions, cache and queues are degraded until it returns.
- **Diagnose:** `dc exec horizon php artisan horizon:status`; `dc logs --tail 200 horizon`; `/platform/failed-jobs` (class and exception class only); `dc exec horizon php artisan queue:failed` for ids.
- **Recover:** restore Redis with the provider; restart workers `dc restart horizon`. Retry failed jobs **one at a time** in `/platform/failed-jobs` for allowlisted classes (step-up required, audited). For a class that is not allowlisted, do **not** use `queue:retry`: read the job's code and idempotency first (a booking notification uses its own domain retry on the Operations page; a webhook event is only safe because the action no-ops once settled).
- **Verify:** failed count stops growing; queued work drains; one end-to-end action (a booking request email) arrives.
- **Evidence:** failed uuids, who retried what (the retry ledger and platform audit), outage times.

## Database incident

- **Detect:** `/ready` `503`; Sentry connection errors; provider alert.
- **Contain:** the app fails closed; do not restart repeatedly. Check the provider status and the cluster's standby/failover state in the console.
- **Diagnose:** connectivity from the VPS (`dc exec web php artisan foundation:smoke`); TLS errors mean the CA or hostname changed (`DB_SSLMODE=verify-full`, `DB_SSLROOTCERT`); a failed migration leaves services on the previous image (see [deployment.md](deployment.md#failed-migration-handling)).
- **Recover:** provider failover for node loss. For data damage or loss, **restore to a NEW cluster** with PITR (RPO 15 minutes) or from the independent dump, validate with `deploy/ops/restore-drill.sh`, then cut over with the incident commander and a second approver. See [backup-and-recovery.md](backup-and-recovery.md).
- **Evidence:** recovery point chosen, validation output, approvals, cutover time.

## Object storage incident

- **Detect:** media upload or display failures; Sentry storage exceptions.
- **Contain:** media is private and served through the application; booking and scheduling data in PostgreSQL are unaffected.
- **Diagnose:** `dc exec web php artisan foundation:smoke` (private object round trip); verify the bucket credentials and region without printing them.
- **Recover:** restore the provider or credentials; if objects were deleted, restore from the bucket's versioning or the provider's backup. **PostgreSQL recovery does not restore media**: media rows keep only an object key, so after a database restore compare keys to the bucket and report missing objects to the affected organizations.
- **Verify:** upload and fetch a logo through the application.
- **Evidence:** affected organizations, missing keys (counts, not URLs).

## Email incident (Resend)

- **Detect:** sign-in codes or booking emails not arriving; failed notification entries on the Operations page; Resend dashboard.
- **Contain:** sign-in codes are sent synchronously, so Owners may be unable to sign in; communicate through the status channel. Do not switch to another provider ad hoc.
- **Diagnose:** `dc logs --tail 200 web | grep -i mail` (no addresses are logged beyond what the code writes); Resend status, domain verification, API key validity.
- **Recover:** fix the key/domain; use `foundation:smoke --mail-to=<test address>` to confirm. Booking notification failures are retried per booking from the Owner Operations page (one logged failure at a time); do not mass re-send.
- **Evidence:** window of failure, count of affected bookings.

## Websocket incident (Reverb)

- **Detect:** live booking updates stop; the `reverb` container is unhealthy.
- **Contain:** the product degrades to refresh-to-update; bookings are unaffected.
- **Diagnose:** `dc ps reverb`; `dc logs --tail 200 reverb`; check the proxy path to Reverb.
- **Recover:** `dc restart reverb`; confirm `REVERB_*` values did not change. Clients reconnect on their own.
- **Verify:** a live update reaches an open browser session (see the staging smoke checklist).
- **Evidence:** outage window.

## Billing incident (PayMongo)

- **Detect:** Owners report paid renewals not reflected; webhook failures in logs or Sentry; failed `ProcessWebhookEvent` jobs.
- **Contain:** access is never revoked by a webhook failure: entitlement is derived from stored instants, and existing bookings stay operable in every state. Do not edit subscription rows by hand.
- **Diagnose:** confirm the webhook registration and `PAYMONGO_WEBHOOK_SECRET` match the environment (test vs live); look for signature or timestamp rejections; `/platform/failed-jobs` for `ProcessWebhookEvent` failures.
- **Recover:** fix the secret or registration, then retry the failed `ProcessWebhookEvent` jobs in `/platform/failed-jobs` (safe: it is a no-op for an already settled event). Provider events are stored once by id, so a re-delivery from PayMongo is also safe.
- **Verify:** the Owner's billing page shows the paid-through date exactly once.
- **Evidence:** payment ids affected (ids only), the corrected configuration, the retry audit entries.

## Platform access incident

- **Lost authenticator or recovery codes:** another administrator resets the factor at `/platform/admins` (password plus code required); the person re-enrolls at next sign-in.
- **No administrator can sign in:** an operator with server access runs `php artisan platform:bootstrap-admin` only if there are **no** administrators; otherwise it changes nothing. In that case restore from a backup or provision through the database under the incident commander's approval and record it.
- **Suspected misuse of support access:** disable the administrator immediately (`/platform/admins`): this ends sessions and any live support session at once. Review `platform_audit_events` by actor; support views and blocked attempts are recorded.
