# 00. Project Bootstrap and Foundation

## Working outcome

A new developer can clone the repository, start the application locally, run the baseline quality checks, and deploy the same application shape to staging without any business-domain functionality implemented yet.

## Users

Development team, QA, DevOps

## Purpose

Establish the minimum production-ready foundation required by all later vertical slices.

This slice must not implement bookings, scheduling, subscriptions, tenant workflows, marketplace features, or other business functionality.

## Applicable implementation areas

- Bootstrap the Laravel modular monolith as the single application.
- Configure Inertia + React + TypeScript.
- Configure Tailwind CSS + shadcn/ui as the shared UI foundation.
- Configure PostgreSQL as the primary relational database.
- Configure Redis for cache, queues, and supporting runtime needs.
- Configure Laravel Horizon for queue visibility and worker operations.
- Configure Laravel Reverb for realtime transport.
- Configure S3-compatible object storage abstraction.
- Configure Laravel Mail with:
  - Mailtrap for development
  - Resend for production
- Configure Docker-based local development.
- Add environment-specific configuration for:
  - development
  - staging
  - production
- Add baseline application configuration for UTC timestamp storage and `Asia/Manila` application display context.
- Establish modular application boundaries without prematurely creating business modules that do not yet exist.
- Add baseline authentication infrastructure only where required to support later implementation.
- Add baseline error handling and structured logging.
- Add application health/readiness endpoint or equivalent operational check.
- Configure:
  - Pest / PHPUnit
  - Vitest
  - React Testing Library
  - Playwright
- Configure static analysis, linting, formatting, and type checking already supported by the selected stack.
- Configure GitHub Actions for required quality checks.
- Configure automatic staging deployment after CI passes.
- Preserve manual production promotion.
- Add baseline database migration structure.
- Add baseline queue worker and scheduler configuration.
- Add environment variable documentation without committing secrets.
- Add local setup and recovery instructions required for development.
- Add baseline security configuration:
  - secure session defaults
  - CSRF protection
  - trusted proxy configuration when applicable
  - secure cookie configuration by environment
  - secret management through environment configuration
- Add baseline observability integration points for:
  - structured logs
  - error tracking
  - uptime monitoring

## Architecture constraints

- Use a Laravel modular monolith.
- Do not introduce microservices.
- Do not introduce Kubernetes.
- Do not introduce a separate backend API application unless required by an approved future decision.
- Do not introduce native mobile applications.
- Do not add business-domain tables, workflows, or features in this slice.
- Prefer framework-native capabilities and existing approved dependencies.
- Keep modules explicit enough to support future domain separation without speculative abstraction.

## Suggested initial structure

```text
app/
├── Modules/
│   └── <future domain modules added only when their vertical slice begins>
├── Support/
│   ├── Logging/
│   ├── Exceptions/
│   └── Shared/
resources/
└── js/
    ├── components/
    ├── layouts/
    ├── pages/
    └── lib/
tests/
├── Feature/
├── Unit/
└── Browser/
```

The exact folders may follow current Laravel/Inertia conventions if the repository already establishes a better compatible structure.

## Environment baseline

### Development

- Dockerized local application runtime
- PostgreSQL
- Redis
- Mailtrap
- Local S3-compatible storage or development-safe equivalent
- Reverb
- Horizon
- Vite dev server

### Staging

- Same application architecture as production
- Managed PostgreSQL
- Managed Redis
- S3-compatible object storage
- Reverb
- Horizon
- Production-like environment variables
- Resend sandbox/test-safe configuration where appropriate

### Production

- Dockerized application on one VPS
- Managed PostgreSQL with PITR
- Managed Redis
- S3-compatible object storage
- Resend
- Horizon
- Reverb
- Structured logging
- Error tracking
- Uptime monitoring

## Baseline quality commands

The repository should expose predictable commands or scripts for:

- dependency installation
- local startup
- backend tests
- frontend tests
- static analysis
- TypeScript checking
- linting
- formatting
- build verification
- focused E2E execution

Prefer a single CI-equivalent command where practical.

## Acceptance criteria

- A developer can clone the repository and start the full development stack using documented commands.
- The application renders a minimal non-business shell successfully.
- PostgreSQL connectivity is verified.
- Redis connectivity is verified.
- Horizon can process a test job.
- Reverb can establish a basic realtime connection.
- Development email can be delivered through Mailtrap.
- Object storage read/write connectivity can be verified without business-specific media.
- The application stores absolute timestamps safely and is configured for `Asia/Manila` display semantics.
- Backend tests run successfully.
- Frontend tests run successfully.
- Playwright can launch the application and complete a baseline smoke test.
- Static analysis, linting, formatting, and TypeScript checks are executable.
- GitHub Actions runs required checks for pull requests.
- Staging deploys automatically only after CI succeeds.
- Production promotion remains manual.
- Health/readiness checks clearly indicate whether the application can serve requests.
- No secrets are committed to the repository.
- No business-domain behavior is implemented in this slice.
- No unnecessary infrastructure or speculative abstractions are introduced.

## Verification requirements

- Fresh-clone local bootstrap test.
- Docker startup test.
- Database migration test from an empty database.
- PostgreSQL connectivity test.
- Redis connectivity test.
- Queue/Horizon smoke test.
- Reverb connection smoke test.
- Mailtrap delivery smoke test.
- Object storage smoke test.
- Backend test suite smoke test.
- Vitest/RTL smoke test.
- Playwright application-load smoke test.
- Production build verification.
- CI workflow verification.
- Staging deployment verification.
- Health/readiness endpoint verification.
- Environment configuration review for secrets and secure defaults.

## Failure cases to handle

- PostgreSQL unavailable.
- Redis unavailable.
- Queue worker unavailable.
- Reverb unavailable.
- Mail provider unavailable.
- Object storage unavailable.
- Missing required environment variables.
- Invalid database credentials.
- Failed migrations.
- Failed CI checks.
- Failed staging deployment.
- Health check reporting dependencies as unhealthy without exposing sensitive information.

## Operational requirements

- Application logs must be structured enough to support production troubleshooting.
- Failed queue jobs must remain visible through Horizon and later operational tooling.
- Deployment should fail safely when build, migration, or health verification fails.
- Database backups and PITR are infrastructure responsibilities, but application configuration must not interfere with them.
- Recovery procedures must be documented sufficiently for developers to restore local/staging environments.
- Production secrets must remain outside source control.

## Security requirements

- Use Laravel-native CSRF protection.
- Use secure session and cookie settings appropriate to each environment.
- Do not expose stack traces or sensitive configuration in production.
- Do not log credentials, OTPs, tokens, secrets, or sensitive environment values.
- Validate required environment variables at startup where practical.
- Use least-privilege infrastructure credentials where supported.
- Keep package and dependency versions explicit and reproducible.

## Out of scope

- Organization onboarding
- Customer accounts
- Staff roles
- Booking workflows
- Scheduling/capacity engine
- Walk-ins
- Notifications beyond infrastructure smoke testing
- PayMongo integration
- Subscription lifecycle
- Business directory
- Tenant branding implementation
- Audit-domain implementation
- Operational conflict workflows
- Marketplace features
- Multi-branch support
- Native mobile applications
- Microservices
- Kubernetes

## Material risks

- Overbuilding the foundation can delay all business slices without delivering customer value.
- Weak environment parity can create staging-only or production-only failures.
- Poor module boundaries can create future coupling, but speculative domain architecture is equally harmful.
- CI that does not mirror developer quality checks creates inconsistent release confidence.
- A bootstrap slice that starts implementing business functionality will blur roadmap ownership and make later vertical specs harder to verify.

## Implementation Context Prompt

Read all authoritative project documentation, approved planning decisions, ADRs, and the current repository state before making changes. I’m asking for a detailed step-by-step implementation guide for the project bootstrap and foundation only. Establish the smallest production-ready Laravel modular monolith foundation using Inertia, React, TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL, Redis, Horizon, Reverb, Docker, S3-compatible storage, Mailtrap for development, Resend for production, Pest/PHPUnit, Vitest, React Testing Library, Playwright, GitHub Actions, structured logging, error tracking integration points, uptime/health checks, and development/staging/production environment separation. Keep timestamp storage UTC-safe with `Asia/Manila` display semantics. Prefer framework-native solutions and existing approved dependencies. Do not implement bookings, scheduling, organizations, subscriptions, customer workflows, staff workflows, marketplace behavior, worker scheduling, native apps, microservices, Kubernetes, or speculative abstractions. Include setup, configuration, verification, failure handling, security defaults, CI/CD baseline, and focused smoke tests. Preserve the approved automatic staging deployment and manual production promotion. Strictly and explicitly follow the required rules and deliverables.
