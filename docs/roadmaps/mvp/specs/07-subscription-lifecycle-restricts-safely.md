# 07. Subscription Lifecycle Restricts Safely

## Working outcome

A tenant can trial, pay, renew, become restricted, recover, or explicitly close without corrupting operational bookings or accidentally deleting data.

## Users

Owner, Platform Admin

## Applicable implementation areas

- Configurable free trial and one global monthly plan.
- PayMongo QR Ph payment request generation and 24-hour expiry.
- Webhook-confirmed payment with idempotent handling.
- Paid-through entitlement semantics and renewal request 7 days before expiry.
- Email reminders at 7, 3, and 1 day before expiry.
- Configurable grace period then restricted/read-only state.
- Restricted-state rules for public booking and existing operational bookings.
- Explicit organization closure with independent 90-day recovery/deletion lifecycle.

## Acceptance criteria

- Payment screenshots never activate subscriptions.
- Duplicate/replayed webhooks do not extend entitlement twice.
- Early renewal extends from current paid-through date.
- Payment during trial starts the paid period when the trial ends.
- Restricted tenants can finish existing bookings but cannot accept new bookings.
- Customers may cancel existing bookings during restriction but cannot reschedule.
- Non-renewal never starts the deletion timer.
- Explicit Owner closure starts the recovery/deletion lifecycle.

## Verification requirements

- Webhook signature/idempotency tests.
- Trial/renewal/grace/restriction boundary tests.
- Paid-through calculation tests.
- Public-booking restriction and existing-operation tests.
- Closure vs non-renewal retention tests.

## Material risks

- Billing defects can incorrectly extend or revoke access.
- Restriction and deletion must remain independent state machines.
- Webhook transitions require strong idempotency.

## Implementation Context Prompt

Inspect the approved subscription, restriction, and retention decisions first. Implement the lifecycle using PayMongo QR Ph payment requests and webhook-confirmed idempotent activation. Use paid-through entitlement semantics. Keep restriction separate from explicit organization closure and deletion. Existing bookings remain operable in restricted state while new bookings and customer reschedules are blocked. Add boundary, replay, and retention tests before completion. Strictly and explicitly follow the required rules and deliverables.
