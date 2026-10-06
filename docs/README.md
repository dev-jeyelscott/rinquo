# Rinquo MVP Planning Package

Status: Approved planning package complete.

## Included

- Core planning documents
- Architectural decision records
- Approved representative reference UI
- Vertical MVP roadmap
- Eight vertical implementation specs
- Final planning quality gate

## Workflow status

1. Decision discovery: Complete
2. Planning documents: Complete
3. Reference UI: Approved
4. Vertical roadmap/specs: Complete
5. Final quality gate: Passed
6. Final ZIP: Complete

## Authority

Implementation authority is ordered: **locked decisions → approved reference UI → design system/tokens/registry → reusable components → page implementation/tests**. Locked decisions are Decisions 1–200 in `decision.md` plus `planning-decisions.md`. Conflicts are resolved by changing the lower level to comply with the higher one; existing code or tests cannot rewrite a locked design contract. A locked contract changes only through explicit approval at the higher level, then propagates downward. See `planning-decisions.md` → Authority order. The Owner mobile settings shell is not yet visually locked (see `reference-ui/README.md`).

Approval of the planning package does not mean the features are implemented; roadmap specs are acceptance criteria.

## Boundary

This package is planning only. It does not implement, bootstrap, or modify the application repository.
