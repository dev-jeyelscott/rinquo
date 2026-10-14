# CI and Bug Fixes

## Objective

Every quality gate passes locally and on GitHub Actions, and the one confirmed user-facing defect left by the slice 00–08 workflow is fixed.

## Scope

- Repair the three GitHub Actions CI jobs (backend, frontend, e2e), which have failed on every `main` push since 2026-10-06.
- Clear the local gate failures: 4 Larastan errors, and 4 subscription Pest tests that read the developer's `.env` plan amount.
- Fix the `customer-booking.spec.ts` strict-mode locator failure, plus any further e2e failure that CI exposes when it runs e2e for the first time.
- Keep `Deploy staging` from running until staging is configured.
- Show the Platform admin second-factor lockout message in recovery-code mode.

## Out of Scope

- The self-recovering Inertia 409 after a reschedule. It is the asset-version response on the development Vite stack, not a product defect.
- The `scheduling-conflicts` e2e flake recorded in task 05. It was never reproduced, so it is only fixed if CI shows it failing.
- The late-arrival and no-show e2e journeys that skip themselves near midnight Manila. That is intended fixture behavior.
- Provisioning staging (the GitHub environment, secrets, VPS and managed services).
- Accessibility and coverage gaps recorded by the workflow artifacts.

## Decisions

1. **CI repair is in scope** and comes first, so later fixes land on a green pipeline.
2. **Staging deploy waits for configuration.** `Deploy staging` runs only when the repository variable `STAGING_ENABLED` is `true`. Until then, `main` stays green, no image is published to GHCR, and production promotion has no staging digest to promote, as intended.

## Assumptions

- No gate is weakened: no Larastan baseline or ignore entry, no skipped or deleted tests, no `continue-on-error`, no `--no-verify`.
- The lockout message stays generic. It does not reveal which factor was throttled or how many attempts remain.
- Decisions 1–226 and the Approved references are unchanged by this work.

## Specs

1. [CI pipeline passes](specs/ci-pipeline-passes.md). No dependencies.
2. [Platform admin recovery lockout message](specs/platform-admin-recovery-lockout-message.md). Independent of spec 1, but should land after it so its push runs through a green pipeline.
