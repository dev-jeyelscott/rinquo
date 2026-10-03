# ADR 0004: Platform-Wide Customer Identity

- Status: Accepted

## Context

Customers should reuse one verified identity and saved vehicles across businesses without exposing tenant activity across organizations.

## Decision

Keep shared customer profile/vehicles at platform scope and bookings/activity tenant-scoped. Use a neutral customer shell for cross-shop data and tenant branding only inside a specific shop context.

## Consequences

Clear ownership boundaries are required in authorization and UI composition. Staff-entered emails must not automatically claim a platform identity.
