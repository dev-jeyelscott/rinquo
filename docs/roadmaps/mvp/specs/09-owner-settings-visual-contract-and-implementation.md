# 09. Owner Settings Visual Contract and Implementation

## Working outcome

The seven Owner Settings pages have approved desktop and mobile visual contracts, those contracts are locked in the Reference UI manifest, the Rinquo design system is reconciled with them, and the current Owner Settings implementation is updated to conform without changing existing business behavior.

The completed outcome covers:

1. Approve the seven desktop/mobile designs.
2. Lock the approved references.
3. Update the design system and UI registry.
4. Implement and verify the seven pages.

The redesign must correct the existing UI-authority drift without redesigning domain behavior that is already correct.

## Users

Primary:

- Owner

Indirectly affected:

- Staff, through the shared tenant application shell
- Customers only where Owner configuration changes public shop behavior

## Authority

Implementation must follow the authority hierarchy defined by Decision 211:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

Applicable decisions include, at minimum:

- Decision 44: responsive PWA
- Decision 46: desktop sidebar and mobile bottom-navigation model
- Decision 47: Staff mobile primary navigation
- Decision 201: Staff authorization boundary
- Decision 206: shared Owner/Staff navigation model
- Decision 207: Owner Settings section navigation
- Decision 208: consolidated desktop tenant navigation
- Decision 209: Settings page heading ownership
- Decision 210: Billing application-level placement
- Decision 211: authority precedence
- Decision 212: Reference UI approval and locking

Domain-specific earlier Locked Decisions remain applicable to each Settings page.

## Dependencies

This work depends on:

- Repaired authority documentation
- Decisions 206–212 being present in `docs/decision.md`
- Reference UI manifest rules being established
- Current design tokens remaining available
- Existing Owner configuration backend behavior remaining functional
- Existing Owner authorization, readiness, scheduling-impact, subscription, and tenant-isolation behavior remaining unchanged unless a defect is explicitly discovered

## Existing implementation baseline

Current implementation already provides the functional Settings routes:

- Profile
- Business Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

Billing also exists but is application-level under Decision 210 and is not one of the seven Settings redesign pages.

Current shared layout:

`resources/js/layouts/owner-shell.tsx`

Known implementation gaps include:

- Mobile uses a compact top navigation rather than the locked bottom-navigation model.
- Settings navigation uses filled pill links instead of the Decision 207 underline pattern.
- The shared shell owns the generic `Scheduling configuration` H1 instead of the page owning its H1.
- Existing shell comments describe superseded behavior.
- Directory currently wraps itself in `OwnerShell` even though the global Inertia layout resolver already applies the shell.
- Existing tests largely validate functional behavior and semantics rather than full responsive visual-contract structure.

These are implementation gaps, not new product decisions.

# Scope

## In scope

### Shared Owner application shell

The redesign must establish one consistent shell used by all seven Settings pages.

Desktop primary navigation:

- Operations
- Booking Requests
- Conflicts
- Billing
- Settings

Desktop requirements:

- Persistent dark tenant sidebar
- Organization identity
- Role-aware destinations
- Active application destination
- Branch context
- Draft / Published context
- Entitlement or restriction messaging where applicable
- Owner identity/sign-out affordance
- Settings content area

Mobile requirements:

- No hamburger as primary application navigation
- Native-style bottom navigation
- Staff-compatible primary model
- Owner-only destinations exposed through `More` where appropriate
- Billing reachable through `More`
- Settings reachable through `More`
- Application navigation remains present while inside Settings
- Safe-area-aware bottom navigation
- Minimum 44px touch targets

### Settings secondary navigation

Settings destinations:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

Desktop:

- Horizontal text links
- Primary-colored active text
- Primary-colored active underline
- No filled active pills
- `aria-current="page"`
- Readiness warning indicators may appear alongside labels

Mobile:

- Horizontally scrollable where required
- Active underline remains visible
- No uncontrolled multi-row wrapping
- Minimum 44px touch target
- Must not replace application-level bottom navigation

### Page heading ownership

Every Settings page owns its page title.

Required titles:

- `Settings · Profile`
- `Settings · Hours`
- `Settings · Services`
- `Settings · Resources`
- `Settings · Booking Policy`
- `Settings · Readiness`
- `Settings · Directory`

Each page may include one short supporting description.

The shared Owner shell must not render `Scheduling configuration` as the universal Settings H1.

# Reference UI approval

## Required reference set

Create desktop and mobile references for all seven pages:

```text
owner-settings-profile-desktop.png
owner-settings-profile-mobile.png

owner-settings-hours-desktop.png
owner-settings-hours-mobile.png

owner-settings-services-desktop.png
owner-settings-services-mobile.png

owner-settings-resources-desktop.png
owner-settings-resources-mobile.png

owner-settings-booking-policy-desktop.png
owner-settings-booking-policy-mobile.png

owner-settings-readiness-desktop.png
owner-settings-readiness-mobile.png

owner-settings-directory-desktop.png
owner-settings-directory-mobile.png
```

Total required page references:

`14`

The shared shell must remain visually consistent across all fourteen references.

Do not independently redesign the shell for each page.

## Reference review order

Review in this order:

1. Profile desktop + mobile
    - Establishes shared shell, Settings navigation, headings, content width, card language, spacing, mobile bottom navigation.

2. Hours desktop + mobile
    - Validates dense editable schedule behavior.

3. Services desktop + mobile
    - Validates the most complex nested configuration surface.

4. Resources desktop + mobile
    - Validates list/edit/manage configuration composition.

5. Booking Policy desktop + mobile
    - Validates simpler policy forms and decision controls.

6. Readiness desktop + mobile
    - Validates status-heavy and publish-action composition.

7. Directory desktop + mobile
    - Validates lightweight configuration and empty visual density.

After each pair:

`Need changes or approve?`

A reference remains `Draft` until explicitly approved.

## Reference approval criteria

A reference may be marked Approved only when:

- It conforms to applicable Locked Decisions.
- Desktop and mobile use the correct application navigation.
- Settings navigation follows Decision 207.
- The page owns its H1.
- Existing business functionality is represented.
- Required states have been considered.
- Existing semantic design tokens are reused where appropriate.
- New reusable patterns are clearly identified.
- Mobile composition is intentionally designed rather than desktop content merely stacked vertically.
- Controls remain practical at realistic viewport sizes.
- Accessibility is feasible from the design.
- The design does not invent unsupported domain behavior.

## Locking approved references

After explicit approval:

1. Store the approved image under `docs/reference-ui/`.
2. Add or update the manifest entry in `docs/reference-ui/README.md`.
3. Set:
    - Surface
    - Route
    - Viewport
    - Status: Approved
    - Applicable decisions
    - Approval date
    - What the reference locks
    - Supersession relationship
4. Record whether the new Owner references partially or fully supersede:
    - `05-owner-scheduling-configuration.png`
5. Never silently overwrite an existing approved reference.

Reference 05 should become fully `Superseded` only if the newly approved references replace all Owner Settings visual patterns it previously governed.

# Page visual contracts

## Profile

Route:

`/settings/profile`

Current behavior that must remain:

- Business name
- Slug context
- Tagline
- Description
- Brand color
- Branch name
- Address
- City
- Phone
- Timezone context
- Logo
- Hero image
- Gallery
- Alt text
- Gallery limits
- Optional media does not block readiness

Design goals:

- Separate business identity from branch/contact information.
- Treat branding/media as a distinct visual area.
- Make required vs optional information obvious.
- Preserve media upload/remove behavior.
- Avoid presenting the page as one giant generated form.

Desktop should support clear content grouping without excessive width.

Mobile should use a deliberate single-column editing flow.

## Hours

Route:

`/settings/hours`

Current behavior that must remain:

- Weekly opening hours
- Multiple intervals per weekday
- Add/remove interval
- Date overrides
- Closed override
- Opening/closing times
- Asia/Manila display semantics
- Validation for invalid or overlapping intervals
- Scheduling impact review where triggered

Design goals:

- Weekly schedule must be scannable.
- Open/closed state should be immediately understandable.
- Multiple intervals must remain manageable.
- Date overrides must be visibly separate from the normal week.
- Mobile must not become an unreadable table.

Prefer day rows/cards over desktop-table assumptions that fail on phones.

## Services

Route:

`/settings/services`

Current behavior that must remain:

- Vehicle types
- Services
- Service descriptions
- Active/archive state
- Service windows
- Service/vehicle variants
- Price
- Duration
- Buffer
- Resource consumption
- Variant availability
- Availability reasons
- Add-ons
- Vehicle restrictions
- Service restrictions

Design goals:

- Reduce the current generic nested-CRUD appearance.
- Preserve the relationship:

`Service → Vehicle Variant → Pricing/Duration → Resource Consumption`

- Availability problems must be clear without exposing unnecessary scheduler internals.
- Active/archive actions must remain distinguishable.
- Complex edit areas may use expansion, cards, drawers, or dialogs only when the approved design proves they improve usability.
- Mobile must avoid deeply nested horizontal structures.

This is the highest-complexity Settings page and should be treated as the stress test for the design system.

## Resources

Route:

`/settings/resources`

Current behavior that must remain:

- Resource types
- Physical resources
- Capacity
- Active state
- Archive state
- Add resource type
- Add physical resource
- Edit resource
- Capacity must remain positive
- Resource availability continues affecting variant readiness

Design goals:

- Clearly separate resource types from individual physical resources.
- Make capacity understandable.
- Avoid repeating full generic forms for every resource when a more focused management pattern is appropriate.
- Archive/deactivation actions must not visually resemble normal primary actions.
- Mobile must preserve editability without dense tables.

## Booking Policy

Route:

`/settings/booking-policy`

Current behavior that must remain:

- Auto-confirm
- Staff approval
- Approval response window
- Slot interval
- Minimum notice
- Booking horizon
- Existing validation
- Stored approval window retained even when auto-confirm is selected
- Scheduling impact behavior where applicable

Design goals:

- Explain policy decisions before numeric tuning.
- Approval mode should have strong conceptual hierarchy.
- Time-rule configuration should remain compact.
- Avoid making every policy field appear equally important.
- Related hours/minutes input must read as one logical setting.

## Readiness

Route:

`/settings/readiness`

Current behavior that must remain:

- Authoritative readiness checklist
- Service/vehicle variant availability
- Reasons for unavailable combinations
- Ready/not-ready status
- Explicit Publish
- Explicit Unpublish
- Published timestamp
- Public shop URL
- Server-side readiness re-check
- Publication remains explicit
- Fixing configuration does not automatically republish

Design goals:

- This page should answer immediately:
    - Is the shop ready?
    - If not, what is blocking it?
    - What must the Owner do next?
- Publish action must be visually dominant only when safe.
- Failed readiness items should provide direct navigation where available.
- Published state must clearly differ from ready-but-unpublished state.
- Mobile must keep the primary status and next action visible without excessive scrolling.

## Directory

Route:

`/settings/directory`

Current behavior that must remain:

- Directory opt-in preference
- Shop appears only when eligible according to product rules
- Direct shop URL remains unaffected
- Save preference

Design goals:

- Keep this page intentionally simple.
- Clearly distinguish:
    - Directory discoverability
    - Direct shop URL availability
- Explain eligibility conditions without excessive technical language.
- Do not invent analytics, directory previews, ranking controls, SEO controls, or unsupported directory functionality.

Implementation must remove the duplicate `OwnerShell` wrapper because the layout resolver already applies it.

# Design-system reconciliation

Do not update the design system until the applicable references are Approved.

After approval, reconcile:

- `docs/design-system/README.md`
- `docs/design-system/tokens.md`, only if genuinely necessary
- `docs/design-system/ui-registry.yaml`
- `resources/css/app.css`, only if approved designs require new semantic tokens
- `resources/js/components/ui/`
- reusable Owner components

## Expected canonical patterns

The updated design system should include or reconcile:

### Tenant application navigation

Canonical behavior:

- Desktop dark sidebar
- Mobile bottom navigation
- Role-aware destinations
- Owner Billing and Settings placement
- No primary mobile hamburger

### Owner Settings navigation

Canonical behavior:

- Route-based links
- Active underline
- Horizontal desktop layout
- Horizontally scrollable mobile layout
- Readiness indicator support
- `aria-current="page"`

### Settings page header

Reusable composition may standardize:

- H1
- supporting description
- optional status/actions
- responsive spacing

Do not make the shell own the page-specific H1.

### Owner configuration section

Existing `SectionCard` may be retained, adjusted, or replaced based on the approved references.

Do not create a second card system when the existing primitive can be corrected.

### Form controls

Continue using existing semantic form primitives unless the approved reference demonstrates a real missing reusable control.

Do not create design-only abstractions with no repeated use.

# Implementation

Implementation starts only after the relevant visual contracts and design-system changes are approved.

## Shared shell

Primary file:

`resources/js/layouts/owner-shell.tsx`

Required changes:

- Implement locked desktop application destinations.
- Preserve Billing as a primary Owner desktop destination.
- Implement mobile bottom navigation.
- Add Owner `More` navigation for secondary/Owner-only destinations.
- Remove the compact-top-bar primary navigation behavior.
- Replace Settings filled-pill navigation with underline navigation.
- Keep Settings navigation separate from application navigation.
- Remove generic Settings H1 ownership.
- Preserve branch/publication context.
- Preserve entitlement/access messaging.
- Preserve flash/status messages.
- Preserve scheduling-impact dialog mounting.
- Preserve server-side authorization assumptions.
- Update stale comments.

Do not combine authorization logic into visual navigation logic.

## App layout resolver

File:

`resources/js/app.tsx`

Verify:

- Owner Settings pages continue receiving `OwnerShell`.
- Operations, Booking Requests, Conflicts, and Billing continue receiving the correct tenant shell.
- Directory must not manually wrap itself.

Do not create nested shells.

## Settings pages

Update:

- `resources/js/pages/owner/settings/profile.tsx`
- `resources/js/pages/owner/settings/hours.tsx`
- `resources/js/pages/owner/settings/services.tsx`
- `resources/js/pages/owner/settings/resources.tsx`
- `resources/js/pages/owner/settings/booking-policy.tsx`
- `resources/js/pages/owner/settings/readiness.tsx`
- `resources/js/pages/owner/settings/directory.tsx`

Each page must:

- Own its H1.
- Own its supporting description.
- Preserve existing server contract.
- Preserve current validation.
- Preserve existing mutation endpoints.
- Preserve existing authorization.
- Preserve readiness behavior.
- Preserve scheduling-impact review behavior.
- Preserve active/archive semantics.
- Preserve loading/processing behavior.
- Preserve accessible errors.

The redesign must not require backend rewrites unless a concrete UI requirement cannot be supported by existing page props.

If new presentation data is required, add the smallest read-only server payload necessary rather than duplicating domain logic in React.

# Backend scope

No intentional business-rule changes are part of this spec.

Backend changes are allowed only when required to expose already-existing domain information needed by an Approved design.

Any such change must:

- preserve organization scoping,
- preserve authorization,
- reuse existing domain services,
- avoid duplicating readiness or scheduling logic,
- avoid changing persistence semantics,
- receive focused feature-test coverage.

Do not add new database tables or migrations solely for this redesign.

# State coverage

Every page must account for applicable states:

- Loading / processing
- Empty
- Populated
- Validation error
- Success
- Disabled
- Restricted entitlement
- Needs attention
- Draft organization
- Published organization

Additional required page-specific states:

### Profile

- No media
- Existing media
- Upload failure
- Gallery limit

### Hours

- No weekly hours
- Multiple intervals
- Closed day
- Date override
- Validation overlap

### Services

- No vehicle types
- No services
- Unavailable variant
- Missing resource consumption
- Archived/inactive records
- Empty add-ons

### Resources

- No resource types
- Type without resources
- Invalid capacity
- Archived/inactive resource

### Booking Policy

- Auto-confirm
- Staff approval
- Validation errors
- Save processing

### Readiness

- Not ready
- Ready but unpublished
- Published
- Unpublish
- Unavailable variants

### Directory

- Opted out
- Opted in
- Ineligible because not published/ready
- Save processing/error

# Accessibility

Minimum requirements:

- WCAG AA contrast
- Semantic navigation landmarks
- `aria-current="page"`
- One meaningful H1 per Settings page
- Logical H2/H3 hierarchy
- Visible keyboard focus
- 44px minimum mobile touch targets
- No status communicated by color alone
- Form controls have associated labels
- Error messages connected to invalid controls
- Keyboard-operable dialogs/menus
- Bottom navigation does not obscure content
- Mobile safe-area padding where necessary
- Horizontal Settings navigation remains keyboard accessible

# Responsive requirements

Target design contracts:

### Mobile

Approximately 375–430px

### Tablet

Derived responsively unless a unique contract is necessary

### Desktop

Approximately 1280–1600px

Requirements:

- No horizontal page overflow.
- Settings secondary navigation may scroll horizontally.
- Forms collapse deliberately rather than mechanically.
- Dense service/resource configuration remains usable without desktop-only tables.
- Fixed or sticky mobile bottom navigation must not cover actions or form content.
- Dialogs and sheets must fit within viewport bounds.

# Verification requirements

## Frontend unit/component tests

Update or add coverage for:

- Owner shell application destinations
- Billing placement
- Settings navigation destinations
- Settings active state
- Readiness warning indicators
- Page-owned H1 behavior
- No generic `Scheduling configuration` H1
- Directory no longer nesting `OwnerShell`
- Mobile bottom navigation structure
- More navigation structure
- Desktop sidebar structure
- Existing page form behavior
- Existing validation behavior
- Processing/disabled states

Existing functional tests should be preserved unless the approved contract intentionally changes the assertion.

## Browser tests

Add focused Playwright coverage for Owner Settings.

Minimum browser verification:

### Desktop

- Sign in as Owner.
- Open Settings.
- Verify dark sidebar.
- Verify:
    - Operations
    - Booking Requests
    - Conflicts
    - Billing
    - Settings
- Verify Settings secondary navigation.
- Navigate all seven Settings pages.
- Verify page-specific H1.
- Verify no nested shell.
- Verify save flow for representative configuration.
- Verify readiness state remains correct.

### Mobile

Use a realistic mobile viewport.

Verify:

- Desktop sidebar is not used as the primary mobile navigation.
- Bottom navigation is visible.
- `More` exposes Settings and Billing.
- Enter Settings.
- Bottom navigation remains available.
- Settings secondary navigation scrolls horizontally.
- Navigate between all seven Settings sections.
- Page content remains usable.
- Primary actions are not obscured by bottom navigation.
- No horizontal document overflow.

## Existing functional regression

Preserve current tests covering:

- Profile validation and media
- Business-hours interval behavior
- Resources capacity validation
- Service configuration
- Booking Policy payloads
- Readiness/publishing
- Billing behavior
- Entitlement restrictions
- Owner authorization
- Tenant isolation

# Acceptance criteria

This vertical outcome is complete only when:

1. All seven Settings pages have approved desktop and mobile Reference UI.

2. Approved files are registered in the Reference UI manifest.

3. Draft/generated images are not mislabeled as Approved.

4. Reference 05 has an explicit supersession relationship.

5. Desktop Owner primary navigation is:

    `Operations / Booking Requests / Conflicts / Billing / Settings`

6. Mobile primary application navigation follows the locked bottom-navigation model.

7. Hamburger navigation is not the primary tenant mobile navigation.

8. Billing remains outside Settings secondary navigation.

9. Settings secondary navigation contains exactly:

    `Profile / Hours / Services / Resources / Booking Policy / Readiness / Directory`

10. Settings navigation uses the approved underline pattern.

11. Each page owns its meaningful H1.

12. `Scheduling configuration` is not used as the universal Settings H1.

13. All seven pages conform to their Approved desktop/mobile references.

14. Existing domain behavior is preserved.

15. Directory is rendered with exactly one Owner shell.

16. Existing authorization and tenant isolation remain intact.

17. Readiness remains server-authoritative.

18. Scheduling-critical changes continue through the existing impact workflow.

19. Existing semantic design tokens are reused unless an Approved reference requires a justified addition.

20. Registry entries describe the approved contract rather than old implementation drift.

21. Frontend tests pass.

22. Relevant backend tests pass.

23. Type checking and linting pass.

24. Production asset build passes.

25. Desktop and mobile browser verification passes.

# Out of scope

Do not include:

- New Owner features unrelated to these pages
- Staff workflow redesign
- Customer UI redesign
- Billing-page redesign beyond shell integration
- New directory functionality
- Analytics
- SEO tools
- Multi-branch support
- Worker scheduling
- Native mobile apps
- New scheduling algorithms
- New subscription behavior
- New resource-capacity rules
- Database redesign
- General application-wide component refactors not required by the approved references
- Dark-mode redesign unless already required by the existing design-system contract

# Material risks

## Design drift

Risk:

Implementation may again become the design authority.

Mitigation:

References must be approved before the design system and implementation are changed.

## Responsive inconsistency

Risk:

Each Settings page could invent its own mobile composition.

Mitigation:

All seven references must use the same shared shell and Settings-navigation contract.

## Functional regression

Risk:

Redesigning complex Services, Resources, and Hours forms could break existing mutation behavior.

Mitigation:

Preserve page contracts and existing regression tests. Treat redesign as presentation restructuring unless a concrete defect requires otherwise.

## Over-componentization

Risk:

The redesign could create abstractions for every visual fragment.

Mitigation:

Extract only genuinely repeated patterns. Prefer existing primitives and components.

## Mobile navigation obstruction

Risk:

Fixed bottom navigation may obscure form controls or save actions.

Mitigation:

Include content-safe-area spacing and verify using browser tests.

## Services-page complexity

Risk:

Nested service/variant/resource-consumption configuration could become harder to operate on mobile.

Mitigation:

Approve the mobile Services reference before implementation and test real editing workflows.

# Execution order

## Step 3. Approve designs

1. Establish the shared shell contract.
2. Review Profile desktop/mobile.
3. Approve or revise.
4. Repeat for Hours.
5. Repeat for Services.
6. Repeat for Resources.
7. Repeat for Booking Policy.
8. Repeat for Readiness.
9. Repeat for Directory.

Do not proceed based on generated Draft designs without explicit approval.

## Step 4. Lock references

After all required pairs are approved:

1. Store final assets.
2. Update the Reference UI manifest.
3. Mark each Approved.
4. Record applicable decisions.
5. Record exact lock scope.
6. Record supersession of Reference 05.
7. Confirm no Draft is presented as canonical.

## Step 5. Update design system

Reconcile, in order:

1. Design-system documentation
2. UI registry
3. Tokens only where necessary
4. Shared primitives only where necessary
5. Shared Owner components
6. Owner shell patterns

Do not modify page code first and then make the registry match it.

## Step 6. Implement

Recommended page implementation order:

1. Shared `OwnerShell`
2. Profile
3. Hours
4. Services
5. Resources
6. Booking Policy
7. Readiness
8. Directory
9. Responsive/E2E regression pass
10. Full applicable quality gates

Each page should be complete and verified before moving to the next where practical.

# Definition of done

The vertical outcome is done when an Owner can use every Settings workflow on desktop and mobile through the approved navigation and visual contract, with all existing business rules preserved and applicable tests passing.

No known conflict may remain between:

`Locked Decisions → Reference UI → Design System → Implementation → Tests`

```

```
