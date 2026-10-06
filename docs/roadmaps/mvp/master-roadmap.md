# MVP Vertical Implementation Roadmap

## Goal

Deliver the approved Rinquo MVP through complete working outcomes. Every slice must preserve tenant isolation, scheduling integrity, booking snapshots, idempotency, auditability, explicit authorization, and the approved production foundation.

## Execution order

0. Project bootstrap and foundation
1. Tenant becomes bookable
2. Customer creates a valid booking
3. Customer manages an existing booking
4. Staff operates bookings and walk-ins
5. Staff resolves scheduling conflicts
6. Customer uses Rinquo across shops
7. Subscription lifecycle restricts safely
8. Platform administration and operational recovery are production-ready

## Dependency rule

A slice is complete only when its applicable UI, server behavior, persistence, authorization, failure handling, tests, documentation, and operational requirements are verified.

Slice `00` establishes the minimum application and infrastructure foundation required by all later slices. It must not implement business-domain functionality.

| #   | Working outcome                                           | Primary users                | Depends on |
| --- | --------------------------------------------------------- | ---------------------------- | ---------- |
| 00  | Project bootstrap and foundation                          | Development team, QA, DevOps | None       |
| 01  | Tenant becomes bookable                                   | Owner                        | 00         |
| 02  | Customer creates a valid booking                          | Customer                     | 01         |
| 03  | Customer manages an existing booking                      | Customer, Staff              | 02         |
| 04  | Staff operates bookings and walk-ins                      | Staff, Owner                 | 02         |
| 05  | Staff resolves scheduling conflicts                       | Staff, Owner, Customer       | 01, 02, 04 |
| 06  | Customer uses Rinquo across shops                         | Customer                     | 01, 02     |
| 07  | Subscription lifecycle restricts safely                   | Owner, Platform Admin        | 01, 02, 04 |
| 08  | Platform administration and recovery are production-ready | Platform Admin, Operations   | 00–07      |

## Foundation baseline

Slice `00` establishes:

- Laravel modular monolith
- Inertia + React + TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL
- Redis + Horizon
- Laravel Reverb
- Docker-based development environment
- S3-compatible object storage
- Mailtrap for development email
- Resend for production email
- Pest / PHPUnit
- Vitest + React Testing Library
- Playwright
- GitHub Actions
- Development, staging, and production environments
- Automatic staging deployment after CI passes
- Manual production promotion
- Structured logging
- Error tracking integration points
- Health/readiness checks
- UTC timestamp storage with `Asia/Manila` display semantics

The bootstrap slice must not introduce bookings, scheduling, organizations, subscriptions, marketplace behavior, native applications, microservices, Kubernetes, or speculative abstractions.

## Non-negotiable invariants

- Tenant-owned data is always organization-scoped.
- Staff cannot modify Owner-only scheduling-critical configuration.
- Booking confirmation atomically revalidates availability.
- Booking creation is idempotent.
- A booking must fit within one compatible physical resource.
- Capacity cannot be intentionally overbooked.
- Confirmed bookings preserve fulfillment snapshots.
- Configuration changes create explicit conflicts rather than silent schedule corruption.
- Invalid lifecycle transitions are rejected server-side.
- Subscription restriction blocks new bookings but preserves existing active work.
- Non-renewal does not trigger deletion. Explicit closure starts the 90-day recovery/deletion lifecycle.
- Infrastructure failures must surface clearly and fail safely.
- Secrets must never be committed to source control.
- Production deployment must not bypass required CI checks.

## Approved UI baseline

UI implementation follows the authority hierarchy defined by Decision 211:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

Reference UI approval follows Decision 212.

Only references explicitly marked `Approved` in:

`docs/reference-ui/README.md`

are authoritative visual contracts.

Approved references apply only to the surfaces, states, patterns, and viewports they explicitly represent.

Do not infer an uncovered responsive composition and describe it as approved.

When an Approved Reference UI conflicts with a later Locked Decision, the Locked Decision takes precedence.

Reference `05-owner-scheduling-configuration.png` remains partially authoritative for unaffected Owner desktop visual language, but Decisions 206–210 supersede conflicting navigation, Settings navigation, Billing placement, and page-heading behavior.

Material UI work must:

1. Read applicable Locked Decisions.
2. Check the Reference UI manifest.
3. Reuse applicable approved design-system patterns.
4. Treat uncovered visual behavior as implementation choice rather than a locked contract.
5. Obtain approval before promoting a material new pattern into the canonical design system.

The Owner Settings redesign requires approved desktop and mobile references for:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

Draft references must not be treated as implementation authority.

Slice `00` does not require a dedicated business UI reference. It only requires the minimum application shell and health/smoke verification necessary to prove the foundation is operational.
