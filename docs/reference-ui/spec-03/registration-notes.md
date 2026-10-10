# Spec 03 Canonical Registration Notes

**User-approved:** 2026-10-09
**Repository status:** Not yet registered. Read-only access, no commit made.
**HEAD verified before preparation:** `d5fb2e74b5436eb2f2de171ba86a476be7fc3f7f`.

Append the following entries to the approved reference table in `docs/reference-ui/README.md`, after copying the package files under `docs/reference-ui/spec-03/`. Do not supersede Spec 02 outcome references.

| Reference | Surface | Viewport | Status | Approved |
| --- | --- | --- | --- | --- |
| `spec-03/desktop/01-confirmed-management.png` | Confirmed booking and management | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/01-confirmed-management.png` | Confirmed booking and management | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/02-pending-approval.png` | Pending approval and management | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/02-pending-approval.png` | Pending approval and management | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/03-in-service-status.png` | Operational progress | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/03-in-service-status.png` | Operational progress | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/04-cancel-reason.png` | Cancellation entry and optional reason | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/04-cancel-reason.png` | Cancellation entry and optional reason | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/05-cancel-confirmation.png` | Final cancellation review | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/05-cancel-confirmation.png` | Final cancellation review | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/06-cancelled-result.png` | Cancellation completed | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/06-cancelled-result.png` | Cancellation completed | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/07-reschedule-select.png` | Choose replacement date and exact start | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/07-reschedule-select.png` | Choose replacement date and exact start | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/08-reschedule-review.png` | Review replacement before applying | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/08-reschedule-review.png` | Review replacement before applying | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/09-reschedule-success.png` | Successful replacement appointment | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/09-reschedule-success.png` | Successful replacement appointment | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/10-cutoff-reached.png` | After self-service cutoff | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/10-cutoff-reached.png` | After self-service cutoff | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/11-tenant-restricted.png` | Shop temporarily restricted | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/11-tenant-restricted.png` | Shop temporarily restricted | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/12-staff-proposed-time.png` | Staff-proposed replacement time | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/12-staff-proposed-time.png` | Staff-proposed replacement time | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/13-proposal-accept-review.png` | Accept proposed time confirmation | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/13-proposal-accept-review.png` | Accept proposed time confirmation | Mobile 390×844 | Approved | 2026-10-09 |
| `spec-03/desktop/14-completed-history.png` | Completed booking and history | Desktop 1600×1000 | Approved | 2026-10-09 |
| `spec-03/mobile/14-completed-history.png` | Completed booking and history | Mobile 390×844 | Approved | 2026-10-09 |

The detailed manifest (`spec-03/manifest.md`) contains each screen’s route, visual contract, Locked Decisions, exclusions, supersession, and implementation notes.

Supporting boards, comparisons, and contact sheets are approved review assets, not additional authoritative customer routes.

## Follow-on work

1. Copy approved artifacts to `docs/reference-ui/spec-03/` and register 28 core references in `docs/reference-ui/README.md`.
2. Reconcile approved patterns with the design system and UI registry, without overriding Spec 02 outcomes.
3. Reconcile missing contracts: operational progress projection, rescheduling availability, vehicle make/model replacement snapshot.
4. Implement the Spec 03 customer flow and regression tests, including cutoff, restriction, rollback, idempotency and concurrency.

**No repository files were edited by this approval package.**
