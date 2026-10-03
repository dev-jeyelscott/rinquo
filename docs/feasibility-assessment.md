# Feasibility Assessment

## Verdict

Feasible as a modular monolith MVP. The difficult part is the scheduling/capacity engine, not the web stack.

## Technical fit

- Laravel + PostgreSQL is suitable for transactional booking and capacity integrity.
- Redis + Horizon is sufficient for queued email work and scheduled reminder/expiry detection.
- Reverb is sufficient for staff/customer live status updates.
- Inertia + React + Tailwind + shadcn/ui is sufficient for the responsive PWA.

## Main complexity

1. Physical-resource feasibility with integer capacity consumption.
2. Atomic holds and confirmation under concurrent booking attempts.
3. Preserving booking snapshots when configuration changes.
4. Conflict generation/reassignment when resources or hours change.
5. Safe tenant isolation across shared customer identity and tenant-scoped activity.
6. Subscription state transitions that restrict new activity without breaking existing bookings.

## Cost posture

The approved single-VPS application plus managed PostgreSQL/Redis keeps operations simple. S3-compatible media, Resend, PayMongo, error tracking, and uptime monitoring add predictable external costs without requiring platform-scale infrastructure.

## Feasibility conditions

Do not weaken transactional capacity checks, tenant scoping, idempotency, or booking snapshots to simplify implementation. Those are core correctness requirements.
