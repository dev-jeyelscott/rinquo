# Planning Decisions

## Authority

The approved `decision.md` Decisions 1–200 remain authoritative. This document records only the final material additions and the resulting planning boundary.

## Additional approved decisions

### Decision 201. Staff authorization boundary
Staff is operational-only. Staff may manage bookings, walk-ins, queue, check-in, service lifecycle, cancellations, conflicts, and operational failures. Owner retains configuration, pricing, resources, profile, staff, billing, and audit responsibilities.

### Decision 202. Identity for staff-created bookings and walk-ins
Walk-ins may use name only, with email optional. Staff-created future appointments require a contact email. A booking is not attached to a platform customer account until that email is customer-verified.

### Decision 203. Platform customer app vs tenant branding
Use a neutral platform shell for directory, cross-shop bookings, vehicles, and profile. Use tenant branding on shop pages and tenant-specific booking flows.

### Decision 204. Subscription period anchoring
Early renewal extends from the existing `paid_until`. If expired, the paid period starts from confirmed payment. Payment during a trial starts the paid month when the trial ends.

### Decision 205. Cancellation vs non-renewal
Non-renewal follows expiry → grace → restricted state and does not automatically start deletion. The 90-day recovery/deletion timer starts only when the Owner explicitly requests organization closure.

## Decision discovery status

Complete. No material unresolved decision remains that is expected to change MVP scope, UX, architecture, security, cost, data integrity, or implementation.
