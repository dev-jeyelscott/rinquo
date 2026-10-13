# Spec 07: Repository findings

**Read-only verified HEAD:** `f58a0786b5d5ee50f3461163146b110f22b20753`, October 12, 2026. No repository changes, builds, or runtime tests were performed.

## Current implementation

- Owner Billing is the primary destination in `owner-shell.tsx`, but the existing URL is `/owner/organizations/{organization}/settings/billing`, which is permitted by Decision 210. Staff access remains server-authorized separately.
- Billing already comprises `PlanStatusCard`, `RenewalCard`, and `ClosureCard`, backed by `BillingPresenter`, `OpenRenewalRequest`, `AccessResolver`, and PayMongo verified webhook processing.
- The 24-hour renewal request can have a shorter-lived provider QR. The current UI refreshes expired QR codes, polls every five seconds when online, and distinguishes provider unavailability from payment success.
- The `subscriptions:send-reminders` job runs hourly and creates/reuses payment requests at reminder thresholds (7/3/1 days). Confirmation always depends on provider-verified server records.
- Explicit `RequestClosure` and `RecoverClosure` are separate from subscription entitlement. Recovery returns to the current entitlement, even if it is still restricted. Marking deletion eligibility after the 90-day window is not itself deletion.
- Platform Admin already supports GET/POST `/platform/plan-terms` with step-up validation, effective-dated immutable global pricing/trial/grace history, and tests. These screens are in scope.

## Material conflicts and limitations

**P0. Trial expiry vs grace:** Locked Decision 100 demands restriction when a trial expires. `Subscription::startTrial()` sets grace end later and `AccessResolver::entitlementAt()` grants grace even after unpaid trial expiration. `tests/Feature/Subscription/EntitlementTest.php` accepts that behavior. Reference 01 follows the higher authority; Reference 11 uses *paid-period* grace. Resolve this implementation conflict independently before acceptance.

**P1. Automatic request regeneration:** Locked Decision 108 requires an automatically renewed payment request after 24-hour expiry. `SendRenewalReminders` triggers only at email thresholds and does not continuously replenish expired requests. The current Owner renewal POST offers a fallback, shown in reference 07. Do not assert that scheduled auto-regeneration already works.

**P1. UX states:** The existing three billing cards could benefit from explicit QR vs request expiry, pending webhook confirmation, stale/offline, restriction protections, typed closure and recovery-expiration states. This is source inspection, not a completed live usability test.

## Source authority and coverage

Read and reviewed: `AGENTS.md`, `docs/decision.md`, `docs/planning-decisions.md`, ADRs 0002/0005, approved Reference UI registration and Specs 05–06 manifests, Owner shell docs, design-system README/tokens/registry, Spec 07 roadmap and user journeys, frontend and PHP billing files, routes, commands, Platform Admin controller/page and test suites. The approved Owner binary PNGs could not be viewed through the text-oriented repository connector, so pixel-by-pixel confirmation is unverified. Its approved patterns and implementation code were inspected. Neither the initially AI-generated exploratory concept board nor its inaccurate navigation/retention details were promoted into the original visual review package.

**Repo:** https://github.com/dev-jeyelscott/rinquo

**Key source files:**
- https://github.com/dev-jeyelscott/rinquo/blob/main/docs/decision.md
- https://github.com/dev-jeyelscott/rinquo/blob/main/resources/js/layouts/owner-shell.tsx
- https://github.com/dev-jeyelscott/rinquo/blob/main/app/Modules/Subscription/Access/AccessResolver.php
- https://github.com/dev-jeyelscott/rinquo/blob/main/app/Modules/Subscription/Actions/SendRenewalReminders.php
- https://github.com/dev-jeyelscott/rinquo/blob/main/app/Modules/Subscription/Actions/OpenRenewalRequest.php
- https://github.com/dev-jeyelscott/rinquo/blob/main/resources/js/pages/platform/plan-terms.tsx
- https://github.com/dev-jeyelscott/rinquo/blob/main/resources/css/app.css
