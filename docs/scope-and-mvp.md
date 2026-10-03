# Scope and MVP

## In scope

### Customer
- Direct tenant booking page
- Searchable business directory by business name and city/municipality
- Guest-first booking with email OTP
- Shared customer account across shops
- Saved vehicles after verification
- Exact-start booking wizard
- Booking history and live booking status
- Self-service cancellation/reschedule before cutoff
- Cancel-only during tenant restriction
- Email notifications

### Tenant operations
- Owner and Staff roles
- Operational-only Staff permissions
- Weekly hours plus date overrides
- Services, vehicle variants, add-ons, prices, buffers, and availability windows
- Resource types and named physical resources
- Integer resource capacity and configurable consumption
- Booking approval mode
- Walk-ins using genuine capacity gaps
- Queue operations, staff-only check-in, physical bay assignment
- Scheduling conflicts and reschedule proposals
- Resource blocking/maintenance
- Operational failure view and retry
- Owner-visible tenant audit log

### Platform
- Self-service tenant onboarding
- Readiness checklist and explicit Publish action
- Platform-wide customer identity
- Platform Admin with password + mandatory 2FA
- Flat monthly SaaS plan
- PayMongo QR Ph subscription payment
- Trial, renewal, grace, restriction, and explicit closure lifecycle
- S3-compatible media storage

## Explicitly out of scope

- Native iOS/Android apps
- Individual worker scheduling
- Customer service deposits/payments
- SMS notifications
- GPS/maps/nearby discovery
- Ratings, promotions, marketplace ranking
- Multi-country support
- Multi-branch operation
- Custom staff permission builder
- Microservices
- Offline transactional mutations

## Hard invariants

- Capacity may never be intentionally overbooked.
- A booking must fit in one physical compatible resource.
- Capacity checks and holds are atomic.
- Booking creation is idempotent.
- Existing confirmed bookings preserve fulfillment snapshots.
- Invalid booking state transitions are rejected server-side.
- Tenant-owned data is organization-scoped.
