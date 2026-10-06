# Planning Decisions

## Authority

`docs/decision.md` is the authoritative locked decision register for Rinquo.

It contains the approved product, architecture, navigation, UX, lifecycle, and governance decisions for the MVP.

The current approved decision range is:

`Decision 1 → Decision 212`

This file is not a second decision register and must not duplicate or redefine locked decisions.

When this document, an ADR, a roadmap, a reference UI, the design system, implementation code, or tests conflict with a Locked Decision, follow the authority precedence defined in Decision 211.

## Decision authority

The authority hierarchy is:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

The repository remains the source of truth for what is currently implemented.

`docs/decision.md` remains the source of truth for what has been approved.

A difference between approved behavior and current implementation is an implementation gap, not permission to rewrite the approved decision.

## Reference UI

Reference UI approval and locking follows Decision 212.

A design artifact becomes authoritative only when it is explicitly registered as `Approved` in:

`docs/reference-ui/README.md`

File presence alone does not constitute approval.

Desktop and mobile references are separate visual contracts where responsive composition materially differs.

## Architecture decisions

Accepted ADRs remain authoritative for the architectural decisions they explicitly record, provided they do not conflict with a later Locked Decision.

Architecture changes that materially alter an approved boundary require either:

- A new Locked Decision
- A new or superseding ADR
- Both when the change affects product and architecture boundaries

## Planning boundary

Decision discovery for the current MVP scope is complete through Decision 212.

Decisions 206–210 clarify the tenant navigation and Owner application structure.

Decision 211 defines authority precedence.

Decision 212 defines Reference UI approval and locking.

Future implementation work must not introduce material product, navigation, architecture, or canonical design changes without first resolving them through the applicable authority layer.

## Change rule

Do not modify Locked Decisions solely to match existing implementation.

When an approved decision intentionally changes:

1. Update `docs/decision.md`.
2. Update affected Reference UI when applicable.
3. Update affected design-system documentation and registry entries.
4. Update implementation.
5. Update tests.

Documentation and implementation must flow from the approved contract, not the reverse.
