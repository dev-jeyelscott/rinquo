# Repository findings. Spec 08 read-only redesign

**Commit inspected:** `952b6f9b9a6e552a1b0a4fac67e3975add5335ff` (main, October 13, 2026). **Repository changed:** No. **Basis:** Read-only GitHub connector file inspection, not application runtime execution.

## Current routes and architecture

- Dedicated Platform Admin guard, own session and neutral `PlatformShell` with six horizontal destinations: Overview, Organizations, Failed jobs, Plan terms, Administrators, Security. `routes/platform.php` defines seven authentication URLs, overview, directory/detail, administration, security, plan terms, failed jobs and narrowly allowlisted support routes.
- `platform/auth/` implements password sign-in, TOTP factor, single-use recovery alternative, initial enrollment, recovery code one-time view, password reset and invitation acceptance. Platform sessions require 2FA, expire at 12-hour absolute / 30-minute idle, and password reset does not bypass 2FA.
- `platform/organizations/` supports name/address search and pagination, member selection and step-up dialog requiring reason and ticket reference. `platform/support/` only provides role-scoped overview and customer-redacted booking request reads. `SupportBanner` persists a 30-minute timer and exit. Expiration routes back to organization detail.
- `platform/admins.tsx` supports invitations/revocations, disable/re-enable and factor reset through `StepUpDialog`. `platform/security.tsx` supports one-time recovery-code rotation.
- `platform/failed-jobs.tsx` exposes class, queue, exception class, failed time, eligibility note, pagination and recent retries; not payload or message. `config/rinquo.php` allowlists **only** `App\Modules\Subscription\Jobs\ProcessWebhookEvent`, with idempotency rationale; retry only one job with step-up. Retry history distinguishes claimed, queued, dispatch_failed. A queued result is NOT handler success.

## Authority and reuse

- Decisions 62–66 lock dedicated admin identity, password + 2FA, read-only tenant support with audited reason, and indefinite audit retention.
- Decisions 81–83 lock Docker VPS + managed DB/Redis, daily backups/PITR and external structured logs/error tracking/uptime monitoring. Decisions 211–212 govern authority and per-viewport approval.
- Accepted ADRs preserve modular monolith, shared-schema tenant isolation, platform-wide customer identity and subscription lifecycle separation. Use `docs/design-system/tokens.md`, `resources/css/app.css` and registered primitives (`Button`, `TextField`, `Alert`, `SectionCard`, `StatusChip`, `StepUpDialog`, `SupportBanner`).
- Existing Spec 07 Platform Plan Terms screens 20 and 21 are **Approved** and remain untouched.

## Weak states and opportunities observed from code

- Current pages are functional and generally compact, but limited-width failed-job class names / multi-status listings require intentional wrapping and hierarchy. The draft uses mobile cards for dense result rows.
- The overview reports retained failed-job count, not a full operational status dashboard. Avoid conflating absence of failed jobs with healthy Redis, queues, or recoverable backups.
- The existing auth factor alternative is a toggle. The draft makes single-use behavior and lost-device navigation legible without adding a new route.
- Step-up dialogs support pending, server validation and network error recovery in code. The critical-state boards capture these separate states for review.
- Tenant support expiration, role permission denial and blocked attempts are server-controlled; do not render fictional tenant mutation controls. Keep session context obvious.
- The source project has append-only audit data but **no browser audit-log route**. Do not invent one.

## Operations belong outside this product UI

- Deployments, production promotion, branch protection: GitHub Actions and operators, not `/platform`.
- Sentry error tracking, structured server logs, uptime: external monitors plus `/up` / `/ready`, not a new app console.
- Managed PostgreSQL, Redis, PITR, dump encryption, restore drill, service recovery: provider consoles, scripts, validation records, ticket tracker and documented runbooks. Recovery must restore to an isolated cluster and validate before cutover. `/ready=200` alone is insufficient proof.
- Backup and restore are operational requirements in `docs/operations/backup-and-recovery.md`, not a supported browser wizard.

## Verification status

Verified by source inspection: routes, component contracts, tests' described assertions, config allowlist and docs. Not verified: runtime UI rendering of the deployed application, direct pixel comparison with binary approved PNGs, real environment health, CI results or production deployment. This draft is designed to surface that distinction, not conceal it.

## Sources inspected

- [`AGENTS.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/AGENTS.md)
- [`docs/decision.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/decision.md)
- [`docs/planning-decisions.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/planning-decisions.md)
- [`docs/adr/0001-modular-monolith.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/adr/0001-modular-monolith.md)
- [`docs/adr/0002-shared-schema-multitenancy.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/adr/0002-shared-schema-multitenancy.md)
- [`docs/adr/0004-platform-customer-identity.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/adr/0004-platform-customer-identity.md)
- [`docs/adr/0005-subscription-lifecycle.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/adr/0005-subscription-lifecycle.md)
- [`docs/roadmaps/mvp/master-roadmap.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/roadmaps/mvp/master-roadmap.md)
- [`docs/roadmaps/mvp/specs/08-platform-admin-and-operational-recovery.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/roadmaps/mvp/specs/08-platform-admin-and-operational-recovery.md)
- [`docs/reference-ui/README.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/reference-ui/README.md)
- [`docs/reference-ui/spec-07/manifest.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/reference-ui/spec-07/manifest.md)
- [`docs/design-system/README.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/design-system/README.md)
- [`docs/design-system/tokens.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/design-system/tokens.md)
- [`docs/design-system/ui-registry.yaml`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/design-system/ui-registry.yaml)
- [`resources/css/app.css`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/resources/css/app.css)
- [`routes/platform.php`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/routes/platform.php)
- [`resources/js/layouts/platform-shell.tsx`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/resources/js/layouts/platform-shell.tsx)
- [`resources/js/types/platform.ts`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/resources/js/types/platform.ts)
- [`resources/js/pages/platform/`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/resources/js/pages/platform/)
- [`resources/js/components/platform/`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/resources/js/components/platform/)
- [`tests/Feature/Platform/`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/tests/Feature/Platform/)
- [`resources/js/test/platform/`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/resources/js/test/platform/)
- [`tests/Browser/platform-admin.spec.ts`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/tests/Browser/platform-admin.spec.ts)
- [`config/rinquo.php`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/config/rinquo.php)
- [`docs/operations/platform-administration.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/operations/platform-administration.md)
- [`docs/operations/monitoring.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/operations/monitoring.md)
- [`docs/operations/environments.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/operations/environments.md)
- [`docs/operations/deployment.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/operations/deployment.md)
- [`docs/operations/backup-and-recovery.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/operations/backup-and-recovery.md)
- [`docs/operations/runbooks.md`](https://github.com/dev-jeyelscott/rinquo/blob/952b6f9b9a6e552a1b0a4fac67e3975add5335ff/docs/operations/runbooks.md)
