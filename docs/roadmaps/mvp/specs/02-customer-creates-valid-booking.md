# 02. Customer Creates a Valid Booking

## Working outcome

A customer can open a tenant page, choose vehicle/service/add-ons, select an exact available start time, verify by email OTP, and create one valid capacity-safe booking.

## Users

Customer

## Applicable implementation areas

- Tenant-branded wizard: Vehicle → Service → Schedule → Details → Confirm.
- Compatibility-aware service/add-on selection and price/duration snapshots.
- Calendar plus booking-interval time chips, disabled unavailable times, and Next available.
- Physical-resource feasibility using configured capacity consumption.
- Pending holds and configurable auto-confirm/staff-approval mode.
- Atomic availability revalidation and idempotent booking creation.
- Guest-first email OTP verification and safe account linking.
- Queued confirmation/reminder email.
- Immutable fulfillment-critical booking snapshots.

## Acceptance criteria

- Customers never see internal capacity counts.
- One booking fits entirely inside one compatible physical resource.
- Concurrent attempts cannot both claim the same final capacity.
- Duplicate retries/double-clicks do not create duplicate bookings.
- Pending approval holds capacity and expires according to policy.
- Confirmed snapshots preserve service, vehicle, add-ons, price, duration, buffer, consumption, selected resource type, and relevant policy values.
- Email failure does not invalidate a successful booking.

## Verification requirements

- Concurrency tests for final-capacity races and temporary holds.
- Idempotency tests for retries and double submissions.
- Scheduler tests for partial capacity, buffers, compatible resource types, and no-capacity states.
- OTP expiry/resend/rate-limit tests.
- Focused Playwright booking journey.

## Material risks

- Aggregate slot counting can produce physically impossible schedules.
- Snapshot omissions can silently rewrite historical booking semantics.
- Unverified email must never claim another customer identity.

## Implementation Context Prompt

Inspect the approved planning documents and customer reference UI first. Build the booking outcome end to end with exact-start availability, per-physical-resource feasibility, integer capacity consumption, atomic holds, transaction-safe confirmation, idempotency, immutable booking snapshots, guest-first email OTP verification, and provider-agnostic queued email. Keep the UI aligned to the approved tenant-branded booking screens. Do not expose scheduler internals or add deposits, SMS, worker scheduling, offline mutations, or native mobile behavior. Strictly and explicitly follow the required rules and deliverables.
