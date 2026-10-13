# Spec 07: Subscription Lifecycle Restricts Safely

**Repository:** https://github.com/dev-jeyelscott/rinquo  
**Verified HEAD:** `f58a0786b5d5ee50f3461163146b110f22b20753` (October 12, 2026)  
**Status:** **Approved by user on 2026-10-13 (Asia/Manila)**. Canonical registration in `docs/reference-ui/README.md` is **prepared but not yet committed**.  
**Viewports:** Desktop **1600 × 1000**, mobile **390 × 844**.  
**References:** 21 paired states, 42 PNGs, 21 comparisons, five state boards, one complete contact sheet.  
**Authority:** Locked Decisions → Approved Reference UI → Design System → Components → Implementation → Tests.

All data, dates, names and prices are illustrative. The QR image is deliberately not usable for payment. **Supersession for every item: None.** Existing approved Owner shell and Specs 02–06 remain in force. User approval was explicitly granted as `Approve all` on 2026-10-13 (Asia/Manila).

## Screen-to-implementation manifest

Every row additionally follows locked Decisions 211 and 212.

| # | Screen | Desktop | Mobile | Current route | Locked Decisions | Implementation boundary | Status |
|---|---|---|---|---|---|---|---|
| 01 | Trial overview | `desktop/01-trial-overview.png` | `mobile/01-trial-overview.png` | `/owner/organizations/{organization}/settings/billing` | 39,40,99,100,101,204 | Trial expiry: Decision 100 requires immediate restriction. Current AccessResolver incorrectly grants unpaid trial grace. Draft follows locked rule. | **Approved** |
| 02 | Paid subscription | `desktop/02-paid-subscription.png` | `mobile/02-paid-subscription.png` | `/owner/organizations/{organization}/settings/billing` | 39,40,102,204 | Paid-through entitlement is server-derived, not set by client. | **Approved** |
| 03 | Upcoming renewal | `desktop/03-renewal-reminder.png` | `mobile/03-renewal-reminder.png` | `/owner/organizations/{organization}/settings/billing` | 103,104 | Hourly scheduler sends threshold reminders; email is not verified payment. | **Approved** |
| 04 | Generate renewal request | `desktop/04-prepare-renewal.png` | `mobile/04-prepare-renewal.png` | `/owner/organizations/{organization}/settings/billing` | 39,40,109 | Reuse Owner Billing renewal POST and backend-generated request terms. | **Approved** |
| 05 | QR ready | `desktop/05-qr-active.png` | `mobile/05-qr-active.png` | `/owner/organizations/{organization}/settings/billing` | 39,109 | QR is illustrative and nonpayable. Provider confirmation, not QR scan, establishes success. | **Approved** |
| 06 | QR expired, request open | `desktop/06-qr-expired.png` | `mobile/06-qr-expired.png` | `/owner/organizations/{organization}/settings/billing` | 39,108,109 | Individual provider QR can expire while 24-hour payment request is still open. | **Approved** |
| 07 | Renewal request expired | `desktop/07-request-expired.png` | `mobile/07-request-expired.png` | `/owner/organizations/{organization}/settings/billing` | 108,109 | Decision 108 requires automatic new request after expiry, currently not fully automated. Manual renewal POST exists. | **Approved** |
| 08 | Waiting for confirmation | `desktop/08-payment-pending.png` | `mobile/08-payment-pending.png` | `/owner/organizations/{organization}/settings/billing` | 39,204 | Polling reflects server data; no new payment pending state or API. | **Approved** |
| 09 | Payment confirmed | `desktop/09-payment-confirmed.png` | `mobile/09-payment-confirmed.png` | `/owner/organizations/{organization}/settings/billing` | 39,204 | Success only after verified webhook and server-updated entitlement. | **Approved** |
| 10 | Provider / offline recovery | `desktop/10-provider-offline.png` | `mobile/10-provider-offline.png` | `/owner/organizations/{organization}/settings/billing` | 39,108 | Existing provider-failure, offline, and polling states are reused. | **Approved** |
| 11 | Grace warning after paid expiry | `desktop/11-paid-grace.png` | `mobile/11-paid-grace.png` | `/owner/organizations/{organization}/settings/billing` | 41,105,199,200,205 | Grace is shown after paid expiry only. Trial grace is a locked-decision conflict in current code. | **Approved** |
| 12 | Restricted Billing | `desktop/12-restricted-billing.png` | `mobile/12-restricted-billing.png` | `/owner/organizations/{organization}/settings/billing` | 41,42,199,200,205 | Restricted Owner Billing remains accessible and existing bookings preserved. | **Approved** |
| 13 | Restricted Operations | `desktop/13-restricted-operations.png` | `mobile/13-restricted-operations.png` | `/owner/organizations/{organization}/operations` | 199,200,201 | Overlay on approved Operations, no replacement of Spec 04. | **Approved** |
| 14 | Restricted storefront notice | `desktop/14-restricted-storefront.png` | `mobile/14-restricted-storefront.png` | `/shops/{slug}` | 42,199,200 | Only the booking-unavailable notice is in scope; no approved storefront supersession. | **Approved** |
| 15 | Organization closure area | `desktop/15-closure-separation.png` | `mobile/15-closure-separation.png` | `/owner/organizations/{organization}/settings/billing` | 205 | Explicit closure action independent of non-renewal. | **Approved** |
| 16 | Typed closure confirmation | `desktop/16-closure-confirm.png` | `mobile/16-closure-confirm.png` | `/owner/organizations/{organization}/settings/billing` | 205 | Exact organization name must be typed; disabled destructive confirmation until matched. | **Approved** |
| 17 | Closed, within recovery | `desktop/17-closed-recoverable.png` | `mobile/17-closed-recoverable.png` | `/owner/organizations/{organization}/settings/billing` | 205 | Owner can recover only inside closure window via existing POST. | **Approved** |
| 18 | Organization recovered | `desktop/18-closure-recovered.png` | `mobile/18-closure-recovered.png` | `/owner/organizations/{organization}/settings/billing` | 205 | Recovery does not renew an expired subscription. | **Approved** |
| 19 | Recovery window ended | `desktop/19-recovery-ended.png` | `mobile/19-recovery-ended.png` | `/owner/organizations/{organization}/settings/billing` | 205 | Self-service recovery ended. Platform Operations handles retention; no auto deletion claim. | **Approved** |
| 20 | Platform plan terms | `desktop/20-platform-terms.png` | `mobile/20-platform-terms.png` | `/platform/plan-terms` | 40,99,105,106,107 | Already supported platform GET, global plan terms, immutable history. | **Approved** |
| 21 | Publish plan terms confirmation | `desktop/21-platform-publish.png` | `mobile/21-platform-publish.png` | `/platform/plan-terms (POST with admin step-up)` | 40,99,105,106,107 | Already supported platform POST, step-up, validation, effective dated version. | **Approved** |

## Blockers for implementation verification

**Trial restriction:** Decision 100 states restriction immediately at trial expiration. In current `Subscription::startTrial()`, `grace_ends_at` is set to trial end plus grace; current `AccessResolver::entitlementAt()` grants grace until that later timestamp. Existing tests expect this behavior. These approved references follow the locked boundary and flag this conflict rather than treating code as authority.

**Automatic renewal request regeneration:** Decision 108 requires automatic generation of a fresh QR Ph payment request after the previous 24-hour request expires. `SendRenewalReminders` creates a request around 7/3/1-day email thresholds, while `OpenRenewalRequest` supports user-triggered generation/refreshed short-lived QR. Expired 24-hour requests are not continuously regenerated. Screen 07 uses the existing manual fallback; automation must be reconciled in implementation.

**Platform configuration:** `/platform/plan-terms` is already supported by routes, UI, step-up, immutable versions, and tests. Approved references 20–21 introduce no new endpoint.

## Visual contract

Desktop Owner sidebar: Operations, Booking Requests, Conflicts, Billing, Settings. Owner mobile: Dashboard, Queue, Bookings, Walk-in, More. Billing is accessed via **More → Billing**; Staff does not access Billing. Use `--sidebar #001f3f`, `--primary #1e40af`, `--success #047857`, `--warning #b45309`, `--destructive #dc2626`, `--border #e5e7eb` and target Instrument Sans. All statuses include text, not color alone. Visible controls and focus behavior must be implemented and tested independently.

New restriction screens do not override approved Spec 03 customer booking management, Spec 04 operations, or tenant storefront references. Existing bookings and customer cancellation remain available. Non-renewal never starts closure/deletion; explicit Owner closure starts the 90-day recovery lifecycle.

## Package structure

- `desktop/`, `mobile/`: 21 standalone references each.
- `comparisons/`: 21 desktop/mobile review images.
- `boards/`: five critical-state and recovery boards.
- `contact-sheet.jpg`: all references at once.
- `findings.md`, `visual-audit.md`, `screen-inventory.csv`, `metadata.json`: evaluation and traceability.
- `source/render.py`: deterministic static image renderer, not a modification to Rinquo.

**Next:** Register these approved references in `docs/reference-ui/README.md` and add the new assets to the actual repository in a separately authorized implementation/registration change. Do not modify the repository as part of this handoff. Then implement and test by vertical outcome; see `registration/IMPLEMENTATION_HANDOFF.md` in the package root.
