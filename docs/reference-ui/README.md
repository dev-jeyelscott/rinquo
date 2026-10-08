# Reference UI Manifest

This directory contains Rinquo's reviewed visual reference designs.

Reference UI participates in the authority hierarchy defined by Decision 211:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

Reference approval and lifecycle follow Decision 212.

A design artifact is authoritative only when its manifest entry is explicitly marked `Approved`.

File presence alone does not constitute approval.

## Status definitions

### Draft

The reference is being designed or reviewed.

A Draft reference:

- may be used for discussion and iteration,
- must not be treated as an implementation contract,
- must not be used to redefine the design system.

### Approved

The reference is an approved visual contract for the surface, viewport, state, and patterns it explicitly represents.

Approved references remain subordinate to Locked Decisions.

### Superseded

The reference has been intentionally replaced.

It remains in the repository for historical context but must not be used as the current implementation baseline.

## Approved reference manifest

Paths are relative to `docs/reference-ui/`.

| Reference                               | Surface                           | Viewport | Status                                      | Approved   |
| --------------------------------------- | --------------------------------- | -------- | ------------------------------------------- | ---------- |
| `01-customer-shop-home.png`             | Tenant-branded customer shop home | Mobile   | Approved                                    | 2026-10-04 |
| `02-booking-schedule.png`               | Tenant booking schedule selection | Mobile   | Approved                                    | 2026-10-04 |
| `03-staff-operations-dashboard.png`     | Staff operational workspace       | Desktop  | Approved                                    | 2026-10-04 |
| `04-scheduling-conflict-resolution.png` | Scheduling conflict resolution    | Desktop  | Approved                                    | 2026-10-04 |
| `05-owner-scheduling-configuration.png` | Owner scheduling configuration    | Desktop  | Superseded for Owner Settings | 2026-10-04 |
| `owner-settings/desktop/owner-shell-desktop.png` | Owner shell and Settings index (`/settings`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/profile-desktop.png` | Settings Profile (`/settings/profile`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/hours-desktop.png` | Settings Hours (`/settings/hours`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/services-desktop.png` | Settings Services (`/settings/services`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/resources-desktop.png` | Settings Resources (`/settings/resources`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/booking-policy-desktop.png` | Settings Booking Policy (`/settings/booking-policy`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/readiness-desktop.png` | Settings Readiness (`/settings/readiness`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/desktop/directory-desktop.png` | Settings Directory (`/settings/directory`) | Desktop 1600×1000 | Approved | 2026-10-08 |
| `owner-settings/mobile/owner-shell-mobile.png` | Owner shell and Settings index (`/settings`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/profile-mobile.png` | Settings Profile (`/settings/profile`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/hours-mobile.png` | Settings Hours (`/settings/hours`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/services-mobile.png` | Settings Services (`/settings/services`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/resources-mobile.png` | Settings Resources (`/settings/resources`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/booking-policy-mobile.png` | Settings Booking Policy (`/settings/booking-policy`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/readiness-mobile.png` | Settings Readiness (`/settings/readiness`) | Mobile 390×844 | Approved | 2026-10-08 |
| `owner-settings/mobile/directory-mobile.png` | Settings Directory (`/settings/directory`) | Mobile 390×844 | Approved | 2026-10-08 |

The original references (01-05) were introduced together with the approved MVP planning baseline. The sixteen Owner Settings references were reviewed and approved on 2026-10-08 under Decision 212.

The PNG files for `01`-`05` were removed from the working tree when the Owner Settings references were introduced. They remain retrievable from Git history (the last commit containing them) and the entries below are kept as history. Their locks are not re-verifiable from the working tree until the images are restored, and `05` is superseded for Owner Settings regardless.

## 01 — Customer shop home

**Reference:** `01-customer-shop-home.png`

**Surface:** Tenant-branded public shop experience

**Viewport:** Mobile

**Status:** Approved

**Locks:**

- Tenant-branded customer presentation
- Shop identity hierarchy
- Primary booking call to action
- Today's-hours presentation
- Location summary
- Popular-service presentation
- Native-feeling mobile composition
- Customer bottom-navigation visual direction where represented

**Does not lock:**

- Desktop composition
- Tablet composition
- States not represented in the image
- Backend behavior
- Exact implementation component boundaries

The desktop customer shop layout must not be inferred from this image and described as locked.

## 02 — Booking schedule

**Reference:** `02-booking-schedule.png`

**Surface:** Customer booking flow, schedule selection

**Viewport:** Mobile

**Status:** Approved

**Locks:**

- Booking progress hierarchy
- Selected-service summary
- Date selection presentation
- Exact-start-time selection presentation
- Available vs unavailable slot hierarchy
- Current selection summary
- Mobile primary-action placement
- Native-feeling mobile booking composition

**Does not lock:**

- Desktop booking composition
- Tablet composition
- Scheduling algorithms
- Capacity calculations not explicitly visualized
- States not represented by the reference

Scheduling behavior remains governed by Locked Decisions and scheduling ADRs.

## 03 — Staff operations dashboard

**Reference:** `03-staff-operations-dashboard.png`

**Surface:** Staff operational workspace

**Viewport:** Desktop

**Status:** Approved

**Locks:**

- Dark desktop tenant sidebar visual language
- Operational workspace visual hierarchy
- Operational status presentation
- Desktop density and content organization
- Navigation styling where not superseded by later Locked Decisions

**Later authority:**

Decisions 206 and 208 define the current application navigation model.

Where the exact navigation destinations in this reference differ from those decisions, the Locked Decisions take precedence.

**Does not lock:**

- Mobile navigation
- Mobile operations composition
- Exact route boundaries for Dashboard, Queue, Bookings, Walk-in, or Operational failures

Mobile tenant navigation is governed by Decisions 46, 47, and 206.

## 04 — Scheduling conflict resolution

**Reference:** `04-scheduling-conflict-resolution.png`

**Surface:** Staff scheduling conflict resolution

**Viewport:** Desktop

**Status:** Approved

**Locks:**

- Conflict severity and warning hierarchy
- Affected-booking presentation
- Resolution-option composition
- Selected-resolution visual treatment
- Desktop conflict-resolution layout
- Operational visual language shared with Staff surfaces

**Does not lock:**

- Mobile conflict-resolution composition
- Conflict-domain state transitions
- Authorization rules
- Exact scheduling conflict algorithms

Domain behavior remains governed by Locked Decisions and scheduling implementation contracts.

## 05 — Owner scheduling configuration

**Reference:** `05-owner-scheduling-configuration.png`

**Surface:** Owner scheduling configuration

**Viewport:** Desktop

**Status:** Superseded for Owner Settings

**Superseded by:** the sixteen Owner Settings references below (approved 2026-10-08).

All Owner Settings shell, application-navigation, Settings-navigation, page-heading, branch/publication-context, and page-composition authority now comes from the sixteen approved Owner Settings references. Reference `05` must not be used as the Owner Settings baseline.

It is retained as history for the old Owner scheduling-configuration surface. It remains the only reference for the Owner configuration impact/review visual direction (the scheduling-impact review step), which the new references do not represent. Decisions 206-210 and the Owner Settings references govern all shared tokens and shell treatment.

This reference predates Decisions 206-210. Their navigation, Settings navigation, Billing placement, and page-heading rules were never overridden by it.

## Owner Settings references (approved 2026-10-08)

All sixteen entries below are `Approved` under Decision 212 on 2026-10-08, with the shared lock boundary and applicable decisions defined here. They replace the Owner Settings portions of reference `05`.

**Files** (relative to `docs/reference-ui/`, canonical paths, not to be renamed or re-exported without a new manifest entry):

- `owner-settings/desktop/{owner-shell,profile,hours,services,resources,booking-policy,readiness,directory}-desktop.png` (1600×1000)
- `owner-settings/mobile/{owner-shell,profile,hours,services,resources,booking-policy,readiness,directory}-mobile.png` (390×844)

**Applicable Locked Decisions:** 44, 46, 47, 201, 206, 207, 208, 209, 210, 211, 212. Page-specific domain Locked Decisions still govern each page's subject matter and are locked here only where the image visibly represents it.

**Owner shell and Settings index, desktop (`owner-shell-desktop.png`)**

Locks:

- Dark Owner application sidebar treatment: wordmark, business and branch identity, Published status chip, the five destinations Operations, Booking Requests, Conflicts, Billing, Settings, filled active destination, account email and Sign out
- Owner destination hierarchy and the Settings active state
- Branch and publication context (branch chip and Published chip) shown as context in the page header, not as Settings navigation
- Settings index composition: `Settings` page heading with description, two-column grid of the seven destination cards (title, description, chevron)
- Desktop Settings navigation: seven route-based text links with a primary-colored active underline, above the page content

**Owner shell and Settings index, mobile (`owner-shell-mobile.png`)**

Locks:

- Mobile header: wordmark, business and branch name, Published chip
- Settings index composition: `Settings` page heading with description, then a vertical list of the seven destinations, each with an initial-letter tile, label, short description, and chevron; Readiness shows its `Ready` status in addition to its label
- Bottom navigation (Dashboard, Queue, Bookings, Walk-in, More) stays visible with `More` active
- No horizontally scrollable secondary navigation is shown or locked on mobile; mobile Settings navigation is the index plus the section back link

**Settings pages, desktop** (`profile`, `hours`, `services`, `resources`, `booking-policy`, `readiness`, `directory` `-desktop.png`)

Lock, per page: the `Settings · <Section>` page heading with description; the SETTINGS eyebrow; the underline Settings navigation with the section active; the branch/publication context; the section-specific card, form, table, status, and action composition; the page spacing and hierarchy.

**Settings pages, mobile** (`profile`, `hours`, `services`, `resources`, `booking-policy`, `readiness`, `directory` `-mobile.png`)

Lock, per page: the `‹ Settings` back link above the heading; the literal short section heading shown (`Profile`, `Hours`, `Services`, `Resources`, `Booking Policy`, `Readiness`, `Directory`) with its description; the single-column card composition; the bottom navigation with `More` active; the mobile branch/publication header.

**Approved interpretations of Locked Decisions (2026-10-08)**

1. *Mobile Settings navigation (Decisions 206 and 207).* Decision 207 asks for horizontal Settings navigation on mobile where practical, and Decision 206 allows an otherwise appropriately composed mobile layout. The approved mobile composition is the Settings index plus a `‹ Settings` back link on each section page. This is the approved reading of "otherwise appropriately composed". A horizontally scrollable underline navigation on mobile is not approved by these references. The Decision 207 mobile amendment in `docs/decision.md` records the same composition.
2. *Mobile page headings (Decision 209).* The mobile references show the literal short section heading (for example `Services`) under the back link instead of `Settings · <Section>`. This literal heading is locked for the mobile reference. Decision 209 remains a Locked Decision and higher authority. The Decision 209 mobile amendment in `docs/decision.md` permits the visible mobile `h1` to omit the `Settings ·` prefix while `Settings · <Section>` remains the required accessible page title and the desktop heading. Any other reading of the mobile heading must be resolved against Decision 209, not this manifest.

**Does not lock (non-authoritative rendering artifacts)**

The images contain rendering defects that are not approved design. Implementations must not reproduce them:

- the `+ Add vehicle` and `+ Add service` buttons overlapping row content in Services desktop
- placeholder or tofu glyph boxes in Resources desktop, Readiness desktop, Resources mobile, Readiness mobile, and the placeholder circle icons in the mobile bottom navigation (icon glyphs are not locked)
- the `Same-day booking...` helper text overflowing its card in Booking Policy desktop
- text overlap and clipping in mobile Profile (cropped at the bottom edge), Hours (overrides card cropped), Booking Policy (description overlapping field labels), and Directory (description overlapping the state rows)
- the cropped or truncated content at the bottom edge of any mobile image

**Also does not lock**

- States not shown: loading, empty, error, validation, disabled, saving, and success states
- Tablet composition and any viewport other than 1600×1000 desktop and 390×844 mobile
- Placeholder sample data, copy beyond headings and structure, and exact pixel dimensions
- Domain behavior, authorization, tenant isolation, readiness derivation, scheduling feasibility, and billing lifecycle, which remain governed by Locked Decisions and ADRs
- Navigation visibility as authorization

Billing remains a primary Owner application destination outside Settings navigation (Decision 210).

## Responsive coverage

Desktop and mobile references are separate visual contracts when their compositions materially differ.

Current approved coverage is incomplete:

| Surface                        | Mobile                        | Desktop                       |
| ------------------------------ | ----------------------------- | ----------------------------- |
| Customer shop home             | Approved                      | Not yet locked                |
| Booking schedule               | Approved                      | Not yet locked                |
| Staff operations               | Not yet locked                | Approved                      |
| Conflict resolution            | Not yet locked                | Approved                      |
| Owner shell and Settings       | Approved (2026-10-08)         | Approved (2026-10-08)         |

Owner Settings coverage is limited to the shell, the Settings index, and the seven pages at the viewports listed above. Owner surfaces outside Settings (Operations, Booking Requests, Conflicts, Billing) have no approved Owner-specific reference.

An uncovered viewport must follow:

1. Applicable Locked Decisions
2. Existing approved design-system patterns
3. Accessibility requirements
4. Responsive implementation guidance

An inferred composition does not become locked merely because it has been implemented.

## Approval workflow

A new visual reference follows this sequence:

`Draft → Review → Approved → Design System → Implementation → Tests`

Before changing a reference to `Approved`:

1. Verify applicable Locked Decisions.
2. Verify navigation and information architecture.
3. Verify desktop/mobile coverage where materially different.
4. Verify accessibility feasibility.
5. Verify use of existing approved tokens and patterns.
6. Identify any new canonical design-system patterns.
7. Record what the reference actually locks.
8. Record any superseded reference.

## Supersession workflow

When replacing an Approved reference:

1. Add the replacement reference.
2. Review it against applicable Locked Decisions.
3. Mark the replacement `Approved`.
4. Mark the old reference `Superseded` if it is fully replaced.
5. If only part is replaced, document the specific superseded areas.
6. Update the design system.
7. Update implementation.
8. Update tests.

Do not silently overwrite approved reference files.

## Interpretation rule

Reference UI is a visual contract, not implementation proof.

A reference tells us what an approved surface should look and behave like within the scope it represents.

To determine what currently exists in Rinquo, inspect the repository implementation.

A difference between the two is an implementation gap.
