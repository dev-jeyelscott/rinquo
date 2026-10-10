# Spec 03 Approved Reference UI Manifest

**Status:** Approved by user on 2026-10-09. The 28 core desktop/mobile references are approved for canonical registration, but are not yet registered in the repository `docs/reference-ui/README.md`.

**Repository:** `dev-jeyelscott/rinquo`  
**Verified HEAD:** `d5fb2e74b5436eb2f2de171ba86a476be7fc3f7f`  
**Generated:** 2026-10-09  
**Authority:** Locked Decisions → Approved Reference UI → Design System → Components → Page implementation → Tests.

## Core reference screens

### `desktop/01-confirmed-management.png`

- **Product surface:** Confirmed booking and management
- **Route / state:** `/shops/{slug}/bookings/{booking} | confirmed | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 70, 112, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 confirmed outcome and tenant header
- **Approved visual contract:** Approved outcome stays at the top of this shared route; the screenshot depicts its scrolled management section
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/01-confirmed-management.png`

- **Product surface:** Confirmed booking and management
- **Route / state:** `/shops/{slug}/bookings/{booking} | confirmed | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 70, 112, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 confirmed outcome and tenant header
- **Approved visual contract:** Approved outcome stays at the top of this shared route; the screenshot depicts its scrolled management section
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/02-pending-approval.png`

- **Product surface:** Pending approval and management
- **Route / state:** `/shops/{slug}/bookings/{booking} | pending | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 14, 70, 112, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 request-sent outcome and tenant header
- **Approved visual contract:** Approved request-sent outcome remains at top; the screenshot depicts its scrolled management section
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/02-pending-approval.png`

- **Product surface:** Pending approval and management
- **Route / state:** `/shops/{slug}/bookings/{booking} | pending | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 14, 70, 112, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 request-sent outcome and tenant header
- **Approved visual contract:** Approved request-sent outcome remains at top; the screenshot depicts its scrolled management section
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/03-in-service-status.png`

- **Product surface:** Operational progress
- **Route / state:** `/shops/{slug}/bookings/{booking} | service | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 9, 14, 70, 186, 203, 211, 212
- **Existing Approved UI affected:** Tenant header only
- **Approved visual contract:** Design target: operational_state must be serialized to customer UI
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs customer projection of operational state.

### `mobile/03-in-service-status.png`

- **Product surface:** Operational progress
- **Route / state:** `/shops/{slug}/bookings/{booking} | service | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 9, 14, 70, 186, 203, 211, 212
- **Existing Approved UI affected:** Tenant header only
- **Approved visual contract:** Design target: operational_state must be serialized to customer UI
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs customer projection of operational state.

### `desktop/04-cancel-reason.png`

- **Product surface:** Cancellation entry and optional reason
- **Route / state:** `/shops/{slug}/bookings/{booking} | cancel-entry | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 200, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Optional reason, deliberate progression to confirmation
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/04-cancel-reason.png`

- **Product surface:** Cancellation entry and optional reason
- **Route / state:** `/shops/{slug}/bookings/{booking} | cancel-entry | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 200, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Optional reason, deliberate progression to confirmation
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/05-cancel-confirmation.png`

- **Product surface:** Final cancellation review
- **Route / state:** `/shops/{slug}/bookings/{booking} | cancel-review | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Dialog preserves old booking until the server confirms cancellation
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/05-cancel-confirmation.png`

- **Product surface:** Final cancellation review
- **Route / state:** `/shops/{slug}/bookings/{booking} | cancel-review | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Dialog preserves old booking until the server confirms cancellation
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/06-cancelled-result.png`

- **Product surface:** Cancellation completed
- **Route / state:** `/shops/{slug}/bookings/{booking} | cancel-done | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 14, 186, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 centered outcome composition
- **Approved visual contract:** Terminal state; no active management actions
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/06-cancelled-result.png`

- **Product surface:** Cancellation completed
- **Route / state:** `/shops/{slug}/bookings/{booking} | cancel-done | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 14, 186, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 centered outcome composition
- **Approved visual contract:** Terminal state; no active management actions
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/07-reschedule-select.png`

- **Product surface:** Choose replacement date and exact start
- **Route / state:** `/shops/{slug}/bookings/{booking} | select | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 schedule exact-start selector
- **Approved visual contract:** Design target: dedicated server-authored replacement availability contract needed
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs reschedule-availability API and server-side validation before implementation.

### `mobile/07-reschedule-select.png`

- **Product surface:** Choose replacement date and exact start
- **Route / state:** `/shops/{slug}/bookings/{booking} | select | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 schedule exact-start selector
- **Approved visual contract:** Design target: dedicated server-authored replacement availability contract needed
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs reschedule-availability API and server-side validation before implementation.

### `desktop/08-reschedule-review.png`

- **Product surface:** Review replacement before applying
- **Route / state:** `/shops/{slug}/bookings/{booking} | review | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 186, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 booking cards and action bar
- **Approved visual contract:** Original remains reserved until replacement secures successfully
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs reschedule-availability API and server-side validation before implementation.

### `mobile/08-reschedule-review.png`

- **Product surface:** Review replacement before applying
- **Route / state:** `/shops/{slug}/bookings/{booking} | review | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 186, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 booking cards and action bar
- **Approved visual contract:** Original remains reserved until replacement secures successfully
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs reschedule-availability API and server-side validation before implementation.

### `desktop/09-reschedule-success.png`

- **Product surface:** Successful replacement appointment
- **Route / state:** `/shops/{slug}/bookings/{booking} | rescheduled | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 14, 186, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 confirmed outcome
- **Approved visual contract:** Use approved confirmed visual; success explains changed time
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/09-reschedule-success.png`

- **Product surface:** Successful replacement appointment
- **Route / state:** `/shops/{slug}/bookings/{booking} | rescheduled | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 14, 186, 203, 211, 212
- **Existing Approved UI affected:** Spec 02 confirmed outcome
- **Approved visual contract:** Use approved confirmed visual; success explains changed time
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/10-cutoff-reached.png`

- **Product surface:** After self-service cutoff
- **Route / state:** `/shops/{slug}/bookings/{booking} | cutoff | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** No unavailable mutation actions; staff exception guidance
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/10-cutoff-reached.png`

- **Product surface:** After self-service cutoff
- **Route / state:** `/shops/{slug}/bookings/{booking} | cutoff | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 113, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** No unavailable mutation actions; staff exception guidance
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/11-tenant-restricted.png`

- **Product surface:** Shop temporarily restricted
- **Route / state:** `/shops/{slug}/bookings/{booking} | restricted | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 199, 200, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Cancel enabled, reschedule unavailable with reason
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/11-tenant-restricted.png`

- **Product surface:** Shop temporarily restricted
- **Route / state:** `/shops/{slug}/bookings/{booking} | restricted | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 10, 112, 199, 200, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Cancel enabled, reschedule unavailable with reason
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/12-staff-proposed-time.png`

- **Product surface:** Staff-proposed replacement time
- **Route / state:** `/shops/{slug}/bookings/{booking} | proposal | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 70, 140-147, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Original time remains reserved until customer accepts
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/12-staff-proposed-time.png`

- **Product surface:** Staff-proposed replacement time
- **Route / state:** `/shops/{slug}/bookings/{booking} | proposal | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 70, 140-147, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Original time remains reserved until customer accepts
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/13-proposal-accept-review.png`

- **Product surface:** Accept proposed time confirmation
- **Route / state:** `/shops/{slug}/bookings/{booking} | proposal-review | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 140-147, 186, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Explicit acceptance and original-slot release conditional on success
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `mobile/13-proposal-accept-review.png`

- **Product surface:** Accept proposed time confirmation
- **Route / state:** `/shops/{slug}/bookings/{booking} | proposal-review | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 140-147, 186, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Explicit acceptance and original-slot release conditional on success
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Current route shared with Spec 02 outcome; preserve approved result composition when returning to the top.

### `desktop/14-completed-history.png`

- **Product surface:** Completed booking and history
- **Route / state:** `/shops/{slug}/bookings/{booking} | completed | viewport/scroll state`
- **Viewport:** 1600×1000
- **Status:** Approved
- **Applicable Locked Decisions:** 9, 14, 70, 186, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Design target: completion status requires operational_state projection
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs customer projection of operational state.

### `mobile/14-completed-history.png`

- **Product surface:** Completed booking and history
- **Route / state:** `/shops/{slug}/bookings/{booking} | completed | viewport/scroll state`
- **Viewport:** 390×844
- **Status:** Approved
- **Applicable Locked Decisions:** 9, 14, 70, 186, 203, 211, 212
- **Existing Approved UI affected:** Tenant header and booking summary
- **Approved visual contract:** Design target: completion status requires operational_state projection
- **Exclusions:** No backend/API changes, no approval override, no new tenant shell; sample booking facts non-authoritative
- **Supersession:** None. Approved Spec 02 is unchanged.
- **Implementation notes:** Needs customer projection of operational state.

## Additional review assets

- `critical-states/`: live connecting/connected/disconnected, refresh failure, stale revision, network uncertainty, policy/cutoff, unavailable replacement, proposal expiry, invalid terminal transitions, checked-in, delayed, in-service, and completed progress. These are **approved supporting design patterns**, not separate canonical routes.
- `comparisons/`: selected paired desktop/mobile screens for responsive approval.
- `review/spec-03-contact-sheet.png`: 14-pair approved review contact sheet.
- `review/contact-sheet-01.png` and `contact-sheet-02.png`: larger review sheets.
- `QA.md`: rendering-level inspection and known contract gaps.

## Implementation and authority constraints

1. The Spec 02 confirmed/request-sent outcomes and tenant-branded header are Approved and remain authoritative. A Spec 03 management view uses the same route but is a *scroll/focus state below* the result. It does not supersede the outcomes.
2. Reschedule selection borrows Spec 02's approved exact-start date/time visual language, but **current Spec 03 lacks a dedicated replacement availability response**. Availability shown is synthetic. A future API must derive available exact start times for the original booked service terms and preserve transactional replacement-before-release.
3. Decision 70 specifies checked-in, delayed, in-service and completed statuses. The customer page currently serializes booking `status`, not `operational_state`, and cannot yet show full progress. Delayed requires an approved/derived presentation rule. The in-service and completed boards are design targets, not implementation claims.
4. `ManageBooking::convertedHold()` and `makeReplacement()` do not copy `vehicle_make_model` despite a newer field in the original snapshot. Fix separately under backend/data-integrity scope with tests.
5. No deposits, customer self-check-in, resource IDs, bay numbers, buffer/capacity detail, or promises of delivered email.
6. All timestamps and availability are illustrative, displayed in Asia/Manila. Names, prices, details, and booking IDs are synthetic and not locked.
7. Image rasterization uses local Inter fallback where Instrument Sans is not available offline. Implementation should use repository Instrument Sans.
8. No changes were made to the GitHub repository, design-system registry, React, PHP, migrations, or tests. Repository registration is required before these references become authoritative in the checked-in canonical manifest.
