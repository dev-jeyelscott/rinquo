# 08. Platform Administration and Operational Recovery

## Working outcome

Platform Admin can safely operate the SaaS, support tenants, and recover from operational failures without weakening tenant boundaries.

## Users

Platform Admin, Operations

## Applicable implementation areas

- Platform Admin email/password authentication with mandatory 2FA.
- Read-only tenant support access by default.
- Audited impersonation only with explicit reason.
- Global subscription price, trial, and grace configuration.
- Append-oriented audit history with indefinite retention.
- Structured logging, error tracking, uptime monitoring, and failed-job visibility.
- Dockerized VPS application with managed PostgreSQL and Redis.
- Daily automated backups plus PostgreSQL PITR.
- Development, staging, and production environments.
- GitHub Actions checks, automatic staging deployment, manual production promotion.
- Recovery/runbook documentation for app, queue, database, storage, email, websocket, and billing incidents.

## Acceptance criteria

- Normal Platform Admin support access cannot mutate tenant data.
- Impersonation requires reason and is attributable in audit history.
- Production deployment cannot bypass required CI checks.
- Failed jobs remain observable and explicitly retryable when safe.
- Backup/PITR restoration procedure is documented and testable.
- Secrets and environment credentials are not committed.

## Verification requirements

- Platform Admin authorization and impersonation tests.
- Audit attribution tests.
- CI checks for backend, frontend, build, and focused E2E.
- Staging smoke-test checklist.
- Backup restore/PITR recovery-drill documentation.
- Failure scenarios for Redis, email, Reverb, PayMongo webhook, and object storage.

## Material risks

- Privileged support access can become a tenant-isolation bypass.
- Backups without restoration verification provide false confidence.
- Single-VPS application availability remains an accepted MVP risk.

## Implementation Context Prompt

Inspect all approved architecture, security, operations, and administration decisions before implementation. Deliver the minimum production operations baseline for a modular monolith: secure Platform Admin access, read-only support by default, audited impersonation, structured logs, error/uptime visibility, failed-job operations, managed stateful services, backup/PITR recovery, environment separation, and gated CI/CD. Do not add Kubernetes, microservices, distributed tracing, or unrelated infrastructure. Strictly and explicitly follow the required rules and deliverables.
