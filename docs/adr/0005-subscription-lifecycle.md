# ADR 0005: Subscription Entitlement Lifecycle

- Status: Accepted

## Context

The MVP uses manual PayMongo QR Ph renewal, trial periods, grace, restricted operation, and an explicit tenant closure flow.

## Decision

Use paid-through entitlement semantics. Early payment extends existing entitlement. Non-renewal causes restriction, not deletion. The 90-day recovery/deletion timer begins only after explicit Owner-requested closure.

## Consequences

Billing and data-retention state machines stay separate, preventing accidental data loss from payment failure or non-renewal.
