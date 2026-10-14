# Platform Admin Recovery Lockout Message

## Outcome

A Platform admin who is rate-limited on the second-factor step sees and hears the lockout message whether they are entering an authenticator code or a recovery code.

## Current Repository State

Verified on 2026-10-13 at `8f7eb67`. Recorded as a follow-up in `.agent-work/08-platform-admin-and-operational-recovery/verify.005.md`.

- `app/Modules/Platform/Http/Controllers/AuthController.php:99-101`: when `RateLimiter::tooManyAttempts($key, 5)` is true on the factor step, it audits `login.factor` / `throttled` and always throws `ValidationException::withMessages(['code' => 'Too many attempts. …'])`.
- `AuthController.php:114`: an ordinary rejected code is keyed to the field the admin submitted (`code` or `recovery_code`).
- `resources/js/pages/platform/auth/factor.tsx`: in recovery mode, only the `recovery_code` field renders, showing `form.errors.recovery_code`. The `code` error has nowhere to render, so the lockout message is neither shown nor announced. Focus still lands on the recovery input.
- The authenticator-code mode shows the lockout correctly.
- `app/Modules/Platform/Http/Requests/FactorRequest.php`: `code` and `recovery_code` are each `required_without` the other.

## Behavior and Invariants

- When the factor step is throttled, the lockout message is keyed to the field the admin submitted: `recovery_code` when a recovery code was submitted, otherwise `code`. This matches the existing rejected-code behavior.
- The message text, the 5-attempt limit, the throttle key, its decay and the `login.factor` / `throttled` audit record are unchanged.
- The throttled response consumes no recovery code and verifies no TOTP code. The throttle check stays before any factor verification.
- The message stays generic. It does not reveal which factor was throttled, the remaining wait, or whether the submitted code was valid.
- The client shows the error on the visible field and moves focus there with the error associated through `aria-describedby`, as for other factor errors (task 08's focus-plus-`aria-describedby` pattern).

## Service / API

- `AuthController` factor step: choose the error key from the submitted field before throwing the throttled `ValidationException`.
- No route, request rule, schema or configuration change.

## UI / UX

- `factor.tsx`: no new component. The existing `TextField` error rendering covers it once the server keys the error correctly. Only add a client fallback if needed: for example, if the admin toggles modes after the error, a stale `code` error must not be lost. Any fallback must reuse existing primitives and the Platform auth pattern.
- Existing design-system and Decision 225 (WCAG 2.2 AA) rules apply. No visual change beyond the message appearing.

## Security / Data Integrity

- Throttling must still be enforced before verification for both factors. Prove that a correct recovery code submitted while throttled is rejected and stays unconsumed.
- The audit trail is unchanged: one `throttled` record per throttled attempt.

## Acceptance Criteria

1. After 5 failed recovery-code attempts, the next recovery-code submission returns the lockout message under `recovery_code`, and the page shows it under the Recovery code field.
2. After 5 failed authenticator-code attempts, the lockout message is still returned under `code` and shown (regression).
3. A valid recovery code submitted while throttled is rejected, and that recovery code remains usable after the throttle decays.
4. A `login.factor` / `throttled` audit record is written for each throttled attempt, as today.
5. Pest feature coverage in `tests/Feature/Platform/AuthenticationTest.php` covers criteria 1–4. Vitest/RTL coverage shows the recovery-mode lockout error rendered and associated with the input.
6. Verified in a real browser at desktop and mobile widths: the message is visible, focus lands on the recovery input, and the input is described by the error.

## End-to-End Acceptance Scenario

A Platform admin signs in with email and password, switches the second factor to "Use a recovery code", and submits five wrong recovery codes. On the sixth submission the page shows "Too many attempts. Wait a few minutes and sign in again." under the Recovery code field, and focus is on that field. Their valid recovery code still works after the throttle window passes.

## Dependencies

Independent of spec 1 (`ci-pipeline-passes`), but should land after it so the change runs through a green pipeline.

## Primary Files

- `app/Modules/Platform/Http/Controllers/AuthController.php`
- `resources/js/pages/platform/auth/factor.tsx`
- `tests/Feature/Platform/AuthenticationTest.php`
- Frontend test for the factor page under `resources/js/test/`
