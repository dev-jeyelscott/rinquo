# Rinquo Project Context

## Purpose

Rinquo is a Philippines-focused, multi-tenant booking platform implemented as one Laravel modular monolith. The application serves tenant-branded shop and booking flows, neutral customer-account flows, and owner/staff operational flows. Product scope and accepted decisions live under `docs/`; the current repository is the source of truth for implemented behavior.

## Project profile

- **Languages and frameworks:** PHP 8.5, Laravel 13, Inertia 3, React 19, TypeScript 5.7, Vite Plus/Vite 8, Tailwind CSS 4, Pest 5, Vitest, React Testing Library, and Playwright.
- **Surfaces:** Inertia web UI and HTTP routes; Artisan commands, scheduled jobs, Horizon queue workers, and Reverb websocket broadcasting; Docker and GitHub Actions deployment configuration.
- **State:** PostgreSQL 17 is the system of record; Redis backs cache, sessions, queues, and Horizon; tenant media uses private S3-compatible object storage. Mail and realtime are external integration boundaries.
- **Trust boundaries:** Public-network, multi-user, shared-schema multi-tenancy. Customer input is untrusted; tenant isolation, role authorization, booking ownership, webhook/provider authenticity, and private-media access are security boundaries.

## Sources of truth

Rinquo separates approved behavior from currently implemented behavior.

### Approved behavior

`docs/decision.md` is the highest authority for approved product, UX, navigation, lifecycle, and governance decisions.

Before making a material product, architecture, navigation, or UI change:

1. Read `docs/decision.md`.
2. Read `docs/planning-decisions.md`.
3. Read applicable ADRs under `docs/adr/`.
4. Read applicable approved Reference UI under `docs/reference-ui/`.
5. Read applicable design-system documentation and registry entries.
6. Inspect the current implementation.

Authority precedence follows Decision 211:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

A lower-authority source must not silently override a higher-authority source.

If two sources at the same authority level materially conflict, stop and resolve the conflict explicitly instead of choosing whichever version matches current code.

### Current implementation

The current repository is the source of truth for what Rinquo currently implements.

Current implementation is not automatically evidence of what has been approved.

When repository behavior conflicts with a higher-authority approved source, treat the difference as an implementation gap.

Do not rewrite authoritative documentation solely to legitimize implementation drift.

### Reference UI

Reference UI approval follows Decision 212.

Only design artifacts explicitly marked `Approved` in:

`docs/reference-ui/README.md`

are authoritative Reference UI.

File presence alone does not constitute approval.

An approved reference is authoritative only for the pages, patterns, states, and viewports it actually represents.

The Owner shell, Settings index, and the seven Owner Settings pages have Approved desktop and mobile references (approved 2026-10-08) under `docs/reference-ui/owner-settings/`. They supersede the Owner Settings portions of reference `05`. Locked Decisions remain higher authority, and the manifest lists rendering artifacts that are not locked. Approval sets the target contract; verify the current implementation separately.

Do not infer unsupported mobile, desktop, responsive, or interaction behavior and describe it as locked.

### Design system

For UI implementation, use:

- `resources/css/app.css`
- `resources/js/components/ui/`
- `docs/design-system/README.md`
- `docs/design-system/tokens.md`
- `docs/design-system/ui-registry.yaml`

The design system must conform to Locked Decisions and Approved Reference UI.

Do not update the design system or UI registry merely to describe existing implementation when that implementation conflicts with a higher-authority source.

### Architecture and domain boundaries

Read applicable ADRs under `docs/adr/` before changing architecture or domain boundaries.

Accepted ADRs currently establish:

- Laravel modular monolith
- Shared-schema tenant data
- Physical-resource scheduling feasibility
- Platform-wide customer identity
- Subscription lifecycle separate from organization closure

A later Locked Decision takes precedence when it explicitly changes an earlier ADR boundary.

### Roadmaps and specifications

Treat `docs/roadmaps/mvp/specs/` as scoped acceptance criteria and implementation guidance.

They are not proof that a feature is implemented.

Inspect current routes, migrations, backend modules, frontend pages, and tests before describing implementation state.

### Operations

For deployment, environment, migration, rollback, and recovery behavior, use:

- `docs/operations/environments.md`
- `docs/operations/deployment.md`

### Local setup and commands

Read `README.md` for supported local setup and the command overview.

`make help` remains the authoritative command list.

## Layout

- `app/Modules/<Domain>/` owns domain models, actions, policies, requests, jobs, events, and supporting services. Existing committed domains are `Identity`, `Tenancy`, `Scheduling`, `Booking`, and `Customer`.
- `app/Support/` contains domain-free cross-cutting concerns. It must not depend on `App\Modules`; `tests/Unit/ArchTest.php` enforces this.
- `resources/js/pages/` contains Inertia pages; `layouts/` contains platform, tenant, owner, and customer shells; `components/ui/` contains shared primitives; domain components sit under named component folders; shared serialized contracts sit under `resources/js/types/`.
- `routes/web.php` owns browser routes, `routes/channels.php` owns private broadcast authorization, and `routes/console.php` owns schedules.
- `database/migrations/` contains forward-only schema changes. `tests/Feature`, `tests/Unit`, `resources/js/**/*.test.ts(x)`, and `tests/Browser` contain backend, frontend, and browser coverage.
- `docker/`, `compose*.yaml`, and `Dockerfile` define local/CI runtime; `deploy/` and `.github/workflows/` define staged deployment and manual production promotion.
- `public/build/`, `vendor/`, and `node_modules/` are generated or installed outputs; do not edit them.

## Commands

Docker Compose is the supported development environment; do not assume host PHP or Node is installed.

- `make setup`: create `.env` when absent, build images, install locked dependencies, generate the app key, start stateful services, initialize object storage, and migrate.
- `make up` / `make down`: start or stop the stack while retaining data.
- `make restart`: restart long-lived application processes after configuration, queue, or Reverb code changes.
- `make smoke`: verify PostgreSQL, Redis, Horizon, Reverb, and object storage; pass `MAIL_TO=<address>` only when an email smoke is intended.
- `make test-backend`: run Pest against real PostgreSQL and Redis.
- `make test-frontend`: run Vitest and React Testing Library.
- `make lint`, `make analyse`, `make types`: run formatting/lint, Larastan level 7, and TypeScript checks.
- `make ci`: run all non-browser gates and the production asset build. The stack must be running.
- `make e2e`: run Playwright against the already-running stack. Use the CI Compose shape described in `README.md` when tests require testing-only routes.
- `make reset`: destructive local recovery; removes containers and volumes before setup. Never run it unless data loss is intended.

`make help` is the authoritative target list. The equivalent direct scripts are defined in `composer.json` and `package.json`; CI uses those scripts in `.github/workflows/ci.yml`.

## Architecture and invariants

- Keep the application a modular monolith. Do not add microservices, Kubernetes, a separate backend API, or speculative modules.
- Tenant-owned records carry `organization_id`. Scope authorization and queries to the organization, and use composite tenant-aware foreign keys where the schema establishes them. A shared customer identity never grants a tenant visibility into another tenant's activity.
- Keep controllers focused on HTTP coordination. Put substantial authorization and normalization in policies and Form Requests, and transactional domain behavior in module actions/services.
- Scheduling-critical organization changes go through `Tenancy\Actions\ChangeOrganization`, which takes the organization lock, records audit effects, assesses booking impact where required, and re-evaluates readiness.
- Capacity-changing booking operations lock the organization first, then the affected hold or booking, and revalidate inside one transaction. Preserve idempotency and database constraints; do not make network calls while holding transaction locks.
- `Scheduling\Readiness\ReadinessEvaluator` is the single readiness rule set. Readiness is derived, not stored. Repairing configuration does not republish a shop.
- Booking fulfillment snapshots are historical facts. Archive or deactivate referenced records instead of deleting them, and preserve the append-only event/audit patterns already used by the owning module.
- Store and process absolute instants in UTC. New PostgreSQL instant columns use `timestampTz()` / `timestampsTz()`. Use `config('app.display_timezone')` and `resources/js/lib/datetime.ts` only for presentation; the current display timezone is `Asia/Manila`.
- Production rollbacks do not reverse migrations. Use backward-compatible expand/contract migrations and never edit a migration that has already run in a deployed environment.

## Conventions

- Follow PSR-4 namespaces and Laravel Pint's `laravel` preset. Prefer native PHP types; use PHPDoc for generics, array shapes, and non-obvious invariants.
- Read environment values only in configuration files; application code reads `config(...)`. Never log or expose credentials, OTPs, tokens, request bodies, environment values, or private storage URLs.
- TypeScript is strict. Use the `@/` alias, explicit types for serialized page contracts, and narrow external values instead of introducing broad `any` casts or suppressions.
- Reuse established actions, helpers, shared types, route builders, UI primitives, semantic tokens, and accessibility patterns before adding abstractions. Do not hardcode colors or create speculative reusable components.
- Preserve neutral platform branding for account/directory surfaces and tenant branding under `/shops/...`.
- Use four-space indentation, LF endings, and a final newline as configured by `.editorconfig`.

## Testing

- Feature tests use Pest with `RefreshDatabase` and the real PostgreSQL engine; do not replace engine-specific constraint, transaction, or lock tests with SQLite or mocks.
- Add focused negative coverage for authorization, cross-tenant access, validation, state transitions, idempotency, and concurrency whenever those concerns change.
- Frontend tests exercise rendered behavior with Vitest and React Testing Library. Browser tests cover critical journeys through the real Docker stack and Reverb.
- Run the narrowest relevant tests while iterating, then the applicable lint, analysis, type, build, and suite-level gates. Report commands that were not run; never weaken a gate to make a change pass.

## Boundaries and working rules

- Never commit `.env`, deploy `app.env`, secrets, credentials, provider payload secrets, or local deployment state. Keep `.env.example` to safe placeholders and document variable purpose in `docs/operations/environments.md`.
- Preserve private-by-default object storage and application-mediated tenant media access.
- Do not expose Horizon outside local development until repository authorization explicitly supports it.
- Do not mix unrelated refactors with a scoped change. Preserve uncommitted user work and inspect the working tree before editing.
- Do not commit or push unless the user explicitly authorizes it.
- Read `docs/decision.md` before making material product, navigation, UX, or architecture changes.
- Follow the authority precedence defined by Decision 211.
- Do not change Locked Decisions, Approved Reference UI, or design-system contracts solely to match existing implementation.
- Do not promote implementation-specific UI into the canonical design system without an approved authoritative basis.
- Only Reference UI marked `Approved` in `docs/reference-ui/README.md` is authoritative.
- Treat implementation that conflicts with a higher-authority source as an implementation gap.
- When a requested change conflicts with a Locked Decision, identify the conflict before implementing it.
