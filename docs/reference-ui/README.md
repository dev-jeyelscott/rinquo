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

| Reference                               | Surface                           | Viewport | Status                                      | Approved   |
| --------------------------------------- | --------------------------------- | -------- | ------------------------------------------- | ---------- |
| `01-customer-shop-home.png`             | Tenant-branded customer shop home | Mobile   | Approved                                    | 2026-10-04 |
| `02-booking-schedule.png`               | Tenant booking schedule selection | Mobile   | Approved                                    | 2026-10-04 |
| `03-staff-operations-dashboard.png`     | Staff operational workspace       | Desktop  | Approved                                    | 2026-10-04 |
| `04-scheduling-conflict-resolution.png` | Scheduling conflict resolution    | Desktop  | Approved                                    | 2026-10-04 |
| `05-owner-scheduling-configuration.png` | Owner scheduling configuration    | Desktop  | Approved, subject to later Locked Decisions | 2026-10-04 |

The original references were introduced together with the approved MVP planning baseline.

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

**Status:** Approved, with specific areas superseded by later Locked Decisions

**Locks where not superseded:**

- Dark desktop Owner sidebar visual language
- Owner configuration visual tone
- Branch and publication-context presentation
- Configuration-card visual direction
- Page spacing and information-density direction
- Configuration impact/review visual direction
- Owner-only configuration context
- General desktop design language for Owner configuration surfaces

### Areas superseded by later Locked Decisions

This reference predates Decisions 206–210.

The following portions of the image are no longer authoritative when they conflict with those decisions.

#### Application navigation

Decision 208 defines the current Owner desktop primary destinations:

- Operations
- Booking Requests
- Conflicts
- Billing
- Settings

The exact sidebar destinations shown in this older reference do not override Decision 208 or Decision 210.

#### Settings section navigation

Decision 207 defines Settings navigation as route-based horizontal text navigation with a primary-colored active underline.

If the older reference visually represents Settings destinations differently, Decision 207 takes precedence.

#### Page heading

Decision 209 requires each Settings page to own a section-specific page heading.

The generic `Scheduling configuration` heading shown by the older reference is therefore not authoritative for all Settings pages.

#### Billing

Decision 210 defines Billing as a primary Owner application destination and explicitly keeps it outside the Settings secondary navigation.

#### Mobile navigation

This reference does not represent mobile behavior.

Owner mobile application navigation is governed by Decisions 206 and 210.

### Replacement requirement

Reference `05` remains useful for the unaffected Owner desktop visual language until the new Owner Settings references are approved.

It should not be deleted merely because portions have been superseded.

When the new Owner Settings desktop references are approved, this manifest must record whether they:

- fully supersede `05`, or
- supersede only its Settings-specific portions.

## Responsive coverage

Desktop and mobile references are separate visual contracts when their compositions materially differ.

Current approved coverage is incomplete:

| Surface                        | Mobile         | Desktop                   |
| ------------------------------ | -------------- | ------------------------- |
| Customer shop home             | Approved       | Not yet locked            |
| Booking schedule               | Approved       | Not yet locked            |
| Staff operations               | Not yet locked | Approved                  |
| Conflict resolution            | Not yet locked | Approved                  |
| Owner configuration / Settings | Not yet locked | Partially covered by `05` |

An uncovered viewport must follow:

1. Applicable Locked Decisions
2. Existing approved design-system patterns
3. Accessibility requirements
4. Responsive implementation guidance

An inferred composition does not become locked merely because it has been implemented.

## Owner Settings redesign

The Owner Settings redesign must eventually provide approved desktop and mobile references for:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

Each reference pair must be reviewed against at least:

- Decision 44
- Decision 206
- Decision 207
- Decision 208
- Decision 209
- Decision 210 where application navigation is represented
- Decision 211
- Decision 212

Additional domain-specific Locked Decisions also apply to each page.

The existing generated redesign images are Draft until explicitly reviewed and entered into this manifest as `Approved`.

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
