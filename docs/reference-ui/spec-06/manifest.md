# Spec 06 Approved Reference UI Manifest

**Project:** Rinquo  
**Scope:** Customer Uses Rinquo Across Shops  
**User approval:** `approve all`, October 12, 2026 (Asia/Manila)  
**Approval outcome:** All 17 paired desktop/mobile screens, **34 canonical PNG references**  
**Target viewports:** Desktop 1600×1000, mobile 390×844  
**Verified repository baseline:** `b55947bbcd291422d257f471aa1b153c62ce1a6d`  
**Canonical registration:** **Prepared, not yet committed.** Registration requires addition to `docs/reference-ui/README.md` in the actual repository.  
**Authority:** Locked Decisions → Approved Reference UI → Design System → Reusable Components → Implementation → Tests.

## User-approved asset inventory

Approval covers the named PNG references and their displayed visual composition only. Static examples are not evidence of existing server behavior. All 34 references have **Status: Approved by user (2026-10-12)**, **Supersedes: None**, and **Superseded by: None**. Their canonical repository status becomes `Approved` after registration in `docs/reference-ui/README.md`.

| # | Surface | Desktop | Mobile | Route / state | Locked Decisions | Approved visual contract | Implementation boundary |
|---|---|---|---|---|---|---|---|
| 01 | Neutral customer Home | ``desktop/01-account-home.png`` | ``mobile/01-account-home.png`` | `/account/directory (landing mode)` | 44, 45, 71–77, 80, 203, 211–212 | Neutral home/search entry, five icon-only accessible mobile destinations | Current directory route reused; Home and Book are distinct client navigation intents, not separate APIs. |
| 02 | Customer email sign-in | ``desktop/02-email-sign-in.png`` | ``mobile/02-email-sign-in.png`` | `/account/auth/login, step=email` | 3, 71–73, 80, 203, 211–212 | Email OTP entry, transparent platform identity boundary | Uses CustomerAuthController requestCode, do not invent password or social sign-in. |
| 03 | Login OTP verification | ``desktop/03-email-otp.png`` | ``mobile/03-email-otp.png`` | `/account/auth/login, step=code` | 3, 71–73, 203, 211–212 | Six-digit email code, pending and verification feedback | Current controller has no restart/resend route; no new endpoint may be inferred. |
| 04 | Searchable business directory | ``desktop/04-shop-directory.png`` | ``mobile/04-shop-directory.png`` | `/account/directory?q=City` | 28, 74–80, 203, 211–212 | Search by business name/city, listed logo/services/starting price/hours/booking CTA | Rich cards need an expanded server read model; illustrated data only. |
| 05 | Directory no matching results | ``desktop/05-directory-empty.png`` | ``mobile/05-directory-empty.png`` | `/account/directory?q=Nonexistent%20Wash%20Center` | 74–78, 203, 211–212 | Explicit valid zero-results state and clear-query action | Distinguish from server, offline, and network errors. |
| 06 | Selected tenant context | ``desktop/06-tenant-handoff.png`` | ``mobile/06-tenant-handoff.png`` | `/account/directory → /shops/{slug}` | 28, 74–79, 80, 203, 211–212 | Visual shift to existing tenant shell and shop colors only | Context demonstration, not a redesign/supersession of approved tenant storefront. |
| 07 | Cross-shop booking overview | ``desktop/07-cross-shop-bookings.png`` | ``mobile/07-cross-shop-bookings.png`` | `/account/bookings` | 71–73, 203, 211–212 | Neutral account list, status, shop origin, booking deep links | Existing server returns only linked online-source bookings; do not claim all other staff-entered activity. |
| 08 | Verified online bookings empty | ``desktop/08-bookings-empty.png`` | ``mobile/08-bookings-empty.png`` | `/account/bookings (empty)` | 3, 71–73, 203, 211–212 | Accurate empty-state explanation with safe discovery path | Never implicitly attach bookings using an unverified staff-entered email. |
| 09 | Shared saved vehicles | ``desktop/09-saved-vehicles.png`` | ``mobile/09-saved-vehicles.png`` | `/account/vehicles` | 24, 71–73, 203, 211–212 | Read-only active saved vehicle list with archive action | Backend currently returns make/model, plate, label only. |
| 10 | Add customer vehicle | ``desktop/10-add-vehicle.png`` | ``mobile/10-add-vehicle.png`` | `POST /account/vehicles from /account/vehicles` | 24, 71–73, 203, 211–212 | Required make/model, optional plate/label, pending/validation | Use existing POST route, do not invent vehicle editing. |
| 11 | Archive vehicle confirmation | ``desktop/11-archive-confirmation.png`` | ``mobile/11-archive-confirmation.png`` | `POST /account/vehicles/{vehicle}/archive (confirmation)` | 24, 71–73, 203, 211–212 | Explicit irreversible-looking action confirmation, existing bookings unchanged | Confirmation is draft UI; archive endpoint already exists and enforces ownership. |
| 12 | Neutral customer profile | ``desktop/12-customer-profile.png`` | ``mobile/12-customer-profile.png`` | `/account/profile` | 71–73, 169, 203, 211–212 | One shared profile with verified email and profile data | Platform profile not tenant-owned. |
| 13 | Edit shared profile | ``desktop/13-edit-profile.png`` | ``mobile/13-edit-profile.png`` | `PATCH /account/profile` | 71–73, 203, 211–212 | Name/optional phone with save, cancel, validation | Preserve existing controller constraints, no extra profile fields. |
| 14 | Request verified email change | ``desktop/14-email-change-request.png`` | ``mobile/14-email-change-request.png`` | `POST /account/profile/email-change` | 71–73, 169, 203, 211–212 | Show original email, new email entry, OTP requested to new address | Do not update current address before new-address verification. |
| 15 | Verify new email address | ``desktop/15-email-change-otp.png`` | ``mobile/15-email-change-otp.png`` | `POST /account/profile/email-change/verify` | 71–73, 169, 203, 211–212 | Six-digit proof, pending verification, unchanged old email until success | Challenge expiry, wrong code, and duplicate email remain server validated. |
| 16 | Email change completed | ``desktop/16-email-change-success.png`` | ``mobile/16-email-change-success.png`` | `/account/profile (success flash)` | 71–73, 169, 203, 211–212 | Neutral success, new verified email, old-email notification intent | Implementation sends old-address email after commit; do not promise delivery. |
| 17 | Email verification failure recovery | ``desktop/17-email-change-recovery.png`` | ``mobile/17-email-change-recovery.png`` | `/account/profile (code error)` | 71–73, 169, 203, 211–212 | Code invalid/expired, no silent mutation, retry feedback | Current pending challenge has no dedicated restart; recovery needs acceptance/design signoff. |

## Locked design and interaction constraints

- Neutral Rinquo branding remains on account sign-in, directory, cross-shop bookings, saved vehicles, and profile. Shop branding is restricted to a selected `/shops/{slug}` context (Decisions 28 and 203).
- Mobile bottom navigation has **five icon-only destinations**: Home, Book, Bookings, Vehicles, Profile. Each destination requires an accessible name, current-state indication and keyboard focus (Decision 45). Home/Book both reuse the existing directory route as different user intents. Do not introduce an independent dashboard endpoint without a separate decision.
- Search is by **business name and city/municipality**, and directory entries must be **Owner opted-in**, published, ready, and accepting new bookings. Direct links are distinct from directory visibility (Decisions 74–78).
- Approved directory cards show **business name, city, logo, services, starting prices, business hours and booking CTA**. The current directory read model does not supply all these fields. Fulfillment requires a separately verified safe projection. Business photos are capped at five (Decisions 78–79).
- One verified account owns a shared profile and shared saved vehicles. Bookings and business activity remain tenant-scoped. An unverified staff-entered email never grants account ownership (Decisions 71–73 and ADR 0004).
- Customer account email change requires verification of **new** email by OTP and attempts notification to **old** email. The old email must remain active until successful server confirmation (Decision 169).
- No new booking/status lifecycle, vehicle-edit endpoint, customer self check-in, or unverified activity linking is implied by reference images.
- The storefront portion of `06-tenant-handoff.png` demonstrates **context only**. Preserve the separately approved tenant shell and tenant booking wizard. No previous Spec 02, 03, 04, 05 or Owner Settings references are superseded.

## Supporting, noncanonical review material

- `review-support/boards/`: seven critical-state visual boards.
- `review-support/comparisons/`: seventeen desktop/mobile pair comparisons.
- `review-support/contact-sheet.png`: contact sheet covering the full batch.
- `review-support/states/`: eleven supplementary states for loading, offline, errors, safe confirmation and outcomes.
- `review-support/repository-findings-and-visual-audit.md`: recorded baseline inspection and known gaps. Original audit used the word Draft because it predates approval; approval does not convert those findings into tested runtime facts.

These aids are **not additional canonical screens**. Review marks, specimen numbering, fabricated shop/customer/booking/vehicle data, illustration photos, and other mock presentation text are **not application requirements**.

## Explicit exclusions and supersession

- **No supersession** of any earlier approved Reference UI.
- No GPS, maps, ratings, reviews, favorites, promotions, advanced directory filters or rankings for MVP.
- No speculative authentication mechanisms, booking APIs, role permissions or tenant activity visibility.
- No front-end assumption that a rendered loading/retry/confirmation mechanism is implemented.
- No new framework, API service or departure from the Laravel modular monolith.

## Registration and implementation boundary

1. Registration task: copy this approved reference family into `docs/reference-ui/spec-06/` and explicitly register all **34** PNGs as Approved in `docs/reference-ui/README.md` (Decision 212). The starter addendum and steps are in the ZIP root. Do not edit or overwrite existing approved files.
2. Implementation task: independently align existing UI against this visual baseline, locked decisions, and current server contracts. Resolve unmet data and retry requirements safely before enabling affected actions.
3. Verify frontend, feature, accessibility and browser tests before claiming feature completion. This approval alone does **not** verify running software or authorize repository writes by the current assistant.
