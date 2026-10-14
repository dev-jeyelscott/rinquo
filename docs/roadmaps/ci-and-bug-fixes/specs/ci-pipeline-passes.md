# CI Pipeline Passes

## Outcome

A push to `main` produces a green `CI` run (backend, frontend, image and e2e jobs), and `make ci` plus `make e2e` (CI Compose shape) pass on a developer machine with a customized `.env`. `Deploy staging` does not run until staging is configured.

## Current Repository State

Verified on 2026-10-13 at `8f7eb67`.

- **GitHub Actions:** every `CI` run on `main` since `73a3948` (2026-10-06) has failed. Run `38405639847` (`e5ef0ab`) shows three independent causes:
  - **backend:** `composer install` runs before the "Prepare environment" step creates `.env`. Its `post-autoload-dump` hook runs `php artisan package:discover`, which boots the app. `AppServiceProvider:47` calls `RequiredEnvironment::assertPresent()`, which throws `Missing required configuration: app.key, app.url, …`.
  - **frontend:** `npm run test` (Vitest) fails at startup with the `laravel-vite-plugin` guard: "You should not run the Vite HMR server in CI environments". `vite.config.ts` loads the `laravel()` plugin for the `test` configuration too.
  - **e2e:** "Start the stack" fails on `docker compose up -d --wait` with `container rinquo-scheduler-1 has no healthcheck configured`. The `scheduler` service in `compose.yaml` has no healthcheck. The `vite` dev-server service also starts in this job, so check whether it survives the CI environment once the scheduler is fixed. Because the job never got past this step, Playwright has never run in CI.
- **Deploy staging:** `.github/workflows/deploy-staging.yml` triggers on a successful `CI` `workflow_run` on `main` and pushes to GHCR. The repository has no `staging` environment or secrets.
- **Local `make analyse`:** 4 errors.
  - `app/Modules/Booking/Http/Controllers/BookingController.php`: `cancel()` and `reschedule()` have no return type.
  - `app/Modules/Identity/Models/User.php`: `customerProfile()` and `customerVehicles()` relation generics are missing.
- **Local `make test-backend`:** 4 failed, 649 passed. `RenewalTest` (3) and `WebhookTest` (wrong-mode dataset) expect the default plan amount `99900`. `config/rinquo.php` reads `RINQUO_PLAN_AMOUNT_CENTAVOS`, and `phpunit.xml` does not pin it, so a developer `.env` that overrides it fails these tests. CI uses `.env.example` (`99900`) and is unaffected.
- **E2E:** `tests/Browser/customer-booking.spec.ts:178` uses `getByText('Full wash + Wax')`, which matches 2 elements on the confirmation page (Playwright strict mode). This was recorded as failing in task 04 verify.003–004 and task 07 verify.004.

## Behavior and Invariants

- Fixes target root causes. Never weaken a gate: no Larastan baseline or ignore entries, no `@phpstan-ignore`, no skipped, `.fixme` or deleted tests, no `continue-on-error`, no lowered Playwright expectations, and no `LARAVEL_BYPASS_ENV_CHECK` exported to the whole job.
- `RequiredEnvironment` keeps failing fast at runtime for missing production configuration. The backend job must not disable it. Fix the step order (or an equivalent that keeps the guard active for the app).
- Vitest must not start a Vite HMR server. Prefer excluding the `laravel()` dev-server plugin from the test configuration (for example `mode === 'test'` or `process.env.VITEST`) over bypassing the guard.
- Every long-running service that `docker compose up --wait` waits for must report healthy or be excluded from the wait for a documented reason. A scheduler healthcheck must prove the process is alive without side effects (it must not run scheduled jobs).
- Assertions in the e2e locator fix stay at least as strict as today: scope the locator to the region the test means (for example the booking summary), rather than using `.first()` blindly.
- Tests pin every configuration value they assert on, so a developer `.env` cannot change their outcome.
- `Deploy staging` runs only when `vars.STAGING_ENABLED == 'true'` in addition to its existing conditions. When the variable is unset, the deploy job is skipped (not failed) and nothing is pushed to GHCR. Production promotion keeps requiring a staging-recorded digest.

## Infrastructure

- `.github/workflows/ci.yml`:
  - backend: order the steps so `.env` exists before anything boots the app, or install without scripts and run them after the environment is prepared;
  - frontend: make the Vitest step pass by fixing the configuration as above;
  - e2e: make "Start the stack" succeed, then make every following step through "Playwright smoke tests" pass.
- `compose.yaml` and `compose.ci.yaml`: the scheduler healthcheck, or CI-specific service selection. Keep local `make up` behavior unchanged.
- `.github/workflows/deploy-staging.yml`: add the `STAGING_ENABLED` repository-variable condition to the deploy job.
- `docs/operations/deployment.md`: document `STAGING_ENABLED`, what must exist before setting it (the `staging` environment, its secrets and host, per `docs/operations/environments.md`), and that production promotion is unavailable until a staging deploy has recorded a digest.

## Service / API

- `BookingController::cancel()` and `reschedule()` declare their real return type (`RedirectResponse` or what they actually return).
- `User::customerProfile()` and `User::customerVehicles()` declare `@return HasOne<CustomerProfile, $this>` and `@return HasMany<CustomerVehicle, $this>`, matching the existing `memberships()` style.

## Tests

- `phpunit.xml` pins `RINQUO_PLAN_AMOUNT_CENTAVOS` (and any other `rinquo.php` plan or billing value a test asserts) with `force="true"`, like `DB_DATABASE`.
- `customer-booking.spec.ts`: the `Full wash + Wax` assertion targets a single element.
- When CI runs e2e for the first time, fix each failure at its root cause in the test, fixture or application. If a failure turns out to be a product defect, record it and stop for scope confirmation; do not silently widen this spec.

## Security / Data Integrity

- Workflows keep least-privilege `permissions`, pinned action SHAs and `persist-credentials: false`.
- No secret, key or real credential is added to workflows, `.env.example` or `phpunit.xml`. CI keeps generating its app key.
- The CI database and services stay ephemeral. Nothing in this spec touches staging or production.

## Acceptance Criteria

1. A `CI` run on the branch or PR passes all four jobs (backend, frontend, image, e2e), with Playwright actually executing the suite. Skips are only the documented self-skips (testing-route probe, midnight Manila).
2. `make analyse` reports 0 errors without a baseline or ignore entry.
3. `make test-backend` passes with `RINQUO_PLAN_AMOUNT_CENTAVOS` set to a non-default value in `.env`.
4. `make ci` passes on the local stack, and `make e2e` passes on the CI Compose shape described in `README.md`.
5. `customer-booking.spec.ts` passes without strict-mode violations.
6. With `STAGING_ENABLED` unset, a green `CI` on `main` produces a skipped `Deploy staging` job and no GHCR push.
7. `docs/operations/deployment.md` documents the `STAGING_ENABLED` switch and its prerequisites.
8. `RequiredEnvironment` still throws when required configuration is missing outside the test environment. The existing test or a focused one proves it.

## End-to-End Acceptance Scenario

A developer sets `RINQUO_PLAN_AMOUNT_CENTAVOS=100` in `.env`, then runs `make ci` and `make e2e` (CI shape), and both pass. They push the branch. GitHub Actions shows backend, frontend, image and e2e all green, and the Playwright step reports the full suite executed. After merge to `main`, `CI` is green and `Deploy staging` shows a skipped deploy job with no image pushed.

## Dependencies

None. Must land before spec 2 (`platform-admin-recovery-lockout-message`) so later pushes run through a green pipeline.

## Primary Files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `compose.yaml`, `compose.ci.yaml`
- `vite.config.ts`
- `phpunit.xml`
- `app/Modules/Booking/Http/Controllers/BookingController.php`
- `app/Modules/Identity/Models/User.php`
- `tests/Browser/customer-booking.spec.ts`
- `docs/operations/deployment.md`
