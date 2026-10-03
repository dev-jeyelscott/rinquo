# 03. Customer Manages an Existing Booking

## Working outcome

A customer can view live booking status and safely cancel or reschedule within policy while preserving booking history and capacity integrity.

## Users

Customer, Staff

## Applicable implementation areas

- Realtime booking detail/status experience.
- Self-service cancellation and rescheduling before cutoff.
- Atomic reschedule: secure replacement slot first, then release original.
- Customer cancellation reason optional, staff reason mandatory.
- Restriction-aware behavior: cancel allowed, reschedule/new booking blocked.
- Server-enforced lifecycle transition rules.
- Immutable completed-booking core facts.

## Acceptance criteria

- Invalid lifecycle transitions are rejected server-side.
- Customer cannot self-cancel/reschedule after cutoff.
- Reschedule never releases the original before the replacement is secured.
- Staff exceptions require reason and audit trail.
- Restricted tenants still allow customer cancellation of existing bookings.
- Completed booking facts cannot be silently rewritten.

## Verification requirements

- Lifecycle transition matrix tests.
- Reschedule race/concurrency tests.
- Cutoff-boundary tests.
- Restriction-state customer-action tests.
- Realtime UI tests for connected, disconnected, delayed, completed, loading, and error states.

## Material risks

- Wrong reschedule transaction order can lose a valid reservation.
- Client-only transition enforcement is bypassable.
- Restriction logic can accidentally block valid completion/cancellation flows.

## Implementation Context Prompt

Inspect the approved booking lifecycle, policy decisions, and customer UI references first. Implement customer booking management as a complete vertical outcome. Enforce lifecycle transitions server-side, use atomic replacement-before-release rescheduling, preserve audit/history, respect cutoff and tenant-restriction rules, and keep completed booking facts immutable. Realtime is presentation support, not the source of truth. Add focused transition, concurrency, restriction, and recovery tests. Strictly and explicitly follow the required rules and deliverables.
