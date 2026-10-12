# Spec 05 Approved Reference UI Manifest

**Project:** Rinquo  
**Scope:** Staff Resolves Scheduling Conflicts  
**Approval:** `approve all`, 2026-10-12 (Asia/Manila)  
**Approval outcome:** All 16 paired desktop/mobile screens, 32 canonical PNG references  
**Repository baseline inspected:** `8d898d68fd4cbca8f919c61607ec0b78a3bc5a9d`  
**Canonical registration:** Registered 2026-10-12 in `docs/reference-ui/README.md`; repository commit pending.  
**Authority:** Locked Decisions → Approved Reference UI → Design System → Reusable Components → Implementation → Tests.

## Approved asset inventory

| # | Desktop / Mobile | Surface | Locked visual and interaction contract | Status |
|---|---|---|---|---|
| 01 | `desktop/01-overview.png` and `mobile/01-overview.png` | Scheduling conflicts workspace | Dashboard summary, unresolved queue, selected conflict and protected original booking | Approved |
| 02 | `desktop/02-queue.png` and `mobile/02-queue.png` | Conflict queue | Soonest-first unresolved queue and recovery labels | Approved |
| 03 | `desktop/03-booking-details.png` and `mobile/03-booking-details.png` | Affected booking details | Booking lifecycle status distinct from operational conflict, cause, resource and original time | Approved |
| 04 | `desktop/04-same-time-reassigned.png` and `mobile/04-same-time-reassigned.png` | Same-time reassignment | Read-only resolved result preserving appointment time | Approved |
| 05 | `desktop/05-replacement-selection.png` and `mobile/05-replacement-selection.png` | Replacement-time selection | Server candidates, selected time and protected original | Approved |
| 06 | `desktop/06-proposal-confirmation.png` and `mobile/06-proposal-confirmation.png` | Send proposal confirmation | Explicit customer approval requirement, notification and temporary dual hold | Approved |
| 07 | `desktop/07-awaiting-response.png` and `mobile/07-awaiting-response.png` | Awaiting customer reply | Deadline, proposal-held capacity and original appointment protection | Approved |
| 08 | `desktop/08-replace-proposal.png` and `mobile/08-replace-proposal.png` | Replace active proposal | Exactly one active proposal, replacement preview and confirmation | Approved |
| 09 | `desktop/09-withdraw-proposal.png` and `mobile/09-withdraw-proposal.png` | Withdraw active proposal | Consequence confirmation and release of proposed hold only | Approved |
| 10 | `desktop/10-customer-accepted.png` and `mobile/10-customer-accepted.png` | Customer acceptance outcome | Resolved, new confirmed time, original released after atomic transition | Approved |
| 11 | `desktop/11-customer-declined.png` and `mobile/11-customer-declined.png` | Customer decline recovery | Original remains, proposal hold released, staff action resumes | Approved |
| 12 | `desktop/12-proposal-expired.png` and `mobile/12-proposal-expired.png` | Proposal expiry recovery | Deadline elapsed, no silent rescheduling, conflict returns to staff | Approved |
| 13 | `desktop/13-resolution-history.png` and `mobile/13-resolution-history.png` | Recently resolved conflicts | Bounded recent history including automatic reassignment | Approved |
| 14 | `desktop/14-impact-preview.png` and `mobile/14-impact-preview.png` | Resource/configuration impact preview | Existing shared precommit impact confirmation dialog, server-issued token | Approved |
| 15 | `desktop/15-stale-offline.png` and `mobile/15-stale-offline.png` | Stale and offline recovery | Invalidate stale claims, refresh, no offline transactional actions | Approved |
| 16 | `desktop/16-no-replacement.png` and `mobile/16-no-replacement.png` | No eligible replacement | No candidates or unlinked customer, safe manual next steps | Approved |

Desktop target: 1600×1000. Mobile target: 390×844. Both compositions are separately approved.

## Applicable authority and inherited design

- Locked Decisions 137–151 govern detection, safe same-time reassignment, approval, deadline, dual holds, one active proposal and atomic capacity.
- Locked Decisions 175–181 preserve historical booking snapshots through configuration changes.
- Locked Decisions 184–185 require a dedicated operational conflict view and impact preview.
- Locked Decisions 201, 206–210 retain Staff operational-only permissions and role-aware Owner/Staff navigation.
- Locked Decisions 211–212 govern authority, approval and supersession.
- Spec 04 continues to define the approved shared application shell and operations patterns. Owner Settings references remain Approved.
- Spec 03 continues to govern customer booking management and customer responses; this package designs the Staff/Owner resolution surface only.
- Reuse Rinquo design tokens from `docs/design-system/tokens.md` and `resources/css/app.css`, and registered components before inventing new ones.

## Supersession relationship

- Upon canonical registration, mark `04-scheduling-conflict-resolution.png` **Superseded by Spec 05**. Its desktop conflict-workspace surface is fully represented by the Spec 05 approved desktop family, particularly 01, 03, 05, 06 and 07.
- Do not delete or overwrite that historical screenshot. It remains provenance for earlier visual decisions.
- Preserve approved application shell, role-aware navigation, color language, original booking protection and proposal deadline from the old reference, subject to higher-priority Locked Decisions.
- Do not supersede any Spec 02, Spec 03, Spec 04 or Owner Settings reference.

## Behavior and implementation boundaries

- The screenshots are visual contracts, **not** proof of implemented or tested runtime behavior.
- Conflict state remains independent of booking lifecycle state. Do not introduce a persisted urgent status.
- Attempt safe compatible same-time reassignment first; never silently move an appointment time.
- Sending a proposal cannot release or replace the original confirmed booking. The proposed slot is held until accepted, declined, expired, withdrawn or replaced.
- Acceptance is server-authorized, idempotent, transactional and capacity revalidated. It confirms new capacity before releasing the original.
- One active reschedule proposal per booking, enforced on the server. Customer agreement is required to change appointment time.
- No frontend-created capacity claims, new booking states, new endpoint, unbounded time search, history pagination or change to current scheduling algorithm is approved.
- Existing read-model limits: up to 100 unresolved conflicts, 20 resolved in the previous 14 days and 12 time candidates in the next seven days. Any expanded scope requires separate approval.
- Illustration dates, people, shop names, counts, labels like “Draft reference”, annotation numbers and presentation footers are **not** production UI data or features. Explicitly exclude the “Draft reference” annotations from implementation.
- Existing Staff permissions exclude Owner-only configuration and Billing. Mobile retains Dashboard, Queue, Bookings, Walk-in, More; Conflicts is accessed through More.
- A static depiction of loading, stale revision, expired proposals, offline state, notifications or a confirmation is not evidence that runtime implementations exist.

## Supporting, noncanonical review assets

- `review-support/boards/`: six critical-state boards.
- `review-support/comparisons/`: sixteen responsive comparisons.
- `review-support/contact-sheet.png`: overall batch review.
- `review-support/states/`: supplementary state compositions.
- `review-support/repository-findings-and-visual-audit.md`: preapproval findings. “Draft” labels are historical and do not reverse user approval.
- `review-support/html-source/`: review render sources only. Not approved application code.

## Implementation and verification boundary

Canonical registration should occur first. Implementation must still be separately planned and verified with backend, frontend, accessibility and browser tests. No runtime checks were executed as part of this approval.
