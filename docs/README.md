# Rinquo MVP Planning Package

Status: Approved MVP planning baseline with documented visual-contract gaps.

## Included

- Authoritative Locked Decision register
- Planning and product documentation
- Architectural decision records
- Reference UI approval manifest
- Approved representative Reference UI
- Design-system documentation and registry
- Vertical MVP roadmap
- Eight vertical implementation specs
- Final planning quality gate

## Workflow status

1. Decision discovery: Complete through Decision 212
2. Authority-chain governance: Complete
3. Architecture baseline: Approved
4. Vertical roadmap/specs: Complete
5. Reference UI governance: Defined by Decision 212
6. Existing representative Reference UI: Approved according to `reference-ui/README.md`
7. Owner Settings desktop/mobile visual refresh: Pending approval
8. Final quality gate: Pass with documented visual gaps

## Authority

`docs/decision.md` is the authoritative Locked Decision register.

Authority precedence follows Decision 211:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

The repository remains the source of truth for what is currently implemented.

Current implementation is not automatically evidence of what has been approved.

When implementation conflicts with a higher-authority source, the difference is an implementation gap.

Reference UI approval follows Decision 212.

Only artifacts explicitly marked `Approved` in:

`docs/reference-ui/README.md`

participate in the authority hierarchy.

File presence alone does not constitute approval.

## Planning and implementation distinction

Planning documents and vertical specs define approved boundaries, requirements, and acceptance criteria.

They are not proof that the current application implements those requirements.

Inspect the current repository when determining implementation state.

Do not modify planning or design authority solely to make it match existing code.

## Current visual-contract status

Existing approved references remain authoritative within the scope recorded in the Reference UI manifest.

Reference `05-owner-scheduling-configuration.png` remains partially authoritative for the unaffected Owner desktop visual language.

Its navigation, Settings navigation, Billing placement, and generic Settings heading are superseded where they conflict with Decisions 206–210.

The seven Owner Settings pages still require approved desktop and mobile references:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

Until those references are approved, generated redesigns remain Draft.

## Boundary

This planning package defines the approved product and implementation contract.

The application repository separately represents current implementation state.

Differences between the two must be handled as explicit implementation gaps.
