# Planning Decisions

## Authority

The approved `decision.md` Decisions 1–200 remain authoritative. This document records only the final material additions and the resulting planning boundary.

### Authority order

This is the canonical authority statement; `AGENTS.md`, `docs/README.md`, `docs/design-system/README.md`, and `docs/reference-ui/README.md` refer to it.

**locked decisions → approved reference UI → design system/tokens/registry → reusable components → page implementation/tests**

- **Locked decisions**: Decisions 1–200 in `docs/decision.md` and the additions in this document.
- **Approved reference UI**: the approved files enumerated in `docs/reference-ui/README.md`.
- **Design system**: `resources/css/app.css`, `docs/design-system/ui-registry.yaml`, and the documented canonical primitives and components.

Rules:

- A conflict is resolved by changing the lower level to comply with the higher one. Implementation conforms upward.
- Existing code, a test assertion, convenience, or an implementation limitation is never sufficient reason to revise a locked decision, approved reference, token or registry rule, or reusable pattern.
- A locked contract changes only through an explicit approval recorded at the appropriate higher level, after which the change propagates downward. Until then the difference is an escalated design-contract change, not something to reconcile silently in pages, tests, components, tokens, or the registry.
- Roadmaps and specs are acceptance criteria and planning documents are not proof of implementation; inspect the code for what is implemented.

### Visual lock status

The Owner mobile settings shell is not yet visually locked. Decision 44 requires a native-feeling responsive PWA and Decision 46 requires staff desktop sidebar plus mobile bottom navigation, but no approved Owner-mobile reference resolves the Owner composition. See `docs/reference-ui/README.md`.

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
