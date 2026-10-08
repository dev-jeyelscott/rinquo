# Design System

Rinquo's design system standardizes approved visual and interaction patterns for implementation.

It is governed by Locked Decisions and Approved Reference UI. It does not independently redefine product or visual decisions.

## Authority

Design-system authority follows Decision 211.

The UI authority hierarchy is:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

The design system must conform to all applicable higher-authority sources.

### Locked Decisions

`docs/decision.md` is the highest authority for approved navigation, UX, responsive behavior, product rules, and explicitly locked design decisions.

A design-system rule that conflicts with a later Locked Decision is stale and must be corrected.

### Approved Reference UI

Approved Reference UI provides the visual implementation baseline where no higher Locked Decision says otherwise.

Reference approval follows Decision 212.

Only artifacts explicitly marked `Approved` in:

`docs/reference-ui/README.md`

are authoritative.

A reference is authoritative only for the surface, state, pattern, and viewport it actually represents.

### Owner Settings visual baseline

The sixteen Owner Settings references approved on 2026-10-08 (`docs/reference-ui/owner-settings/desktop/` and `docs/reference-ui/owner-settings/mobile/`) are the current visual baseline for the Owner shell, the Settings index, and the seven Settings pages at desktop (1600×1000) and mobile (390×844). They supersede the Owner Settings portions of `05-owner-scheduling-configuration.png`.

The registry records the resulting patterns: `tenant-application-navigation`, `tenant-mobile-bottom-navigation`, `owner-settings-navigation`, `owner-settings-page-heading`, `owner-branch-publication-context`, and `owner-settings-responsive-composition`. The Owner mobile hamburger/collapsible-sidebar shell and the filled-pill Settings navigation are deprecated (`owner-mobile-collapsible-shell`, `owner-settings-filled-pill-navigation`). These patterns are `proposed` until the Owner shell implementation conforms to them.

Rendering artifacts in the references (overlapping buttons, tofu glyphs, overflowing or clipped text, placeholder icons) and unrepresented states (loading, empty, error, validation, success) are not part of the baseline. Locked Decisions remain higher authority; see the manifest for the recorded interpretations of Decisions 206, 207, and 209.

### Design-system sources

The implementation-level design system consists of:

- **Design Tokens:** `resources/css/app.css`
- **Token Documentation:** `docs/design-system/tokens.md`
- **UI Primitives:** `resources/js/components/ui/`
- **UI Registry:** `docs/design-system/ui-registry.yaml`
- **Documented Patterns:** this design-system documentation

These sources standardize approved patterns but remain below Locked Decisions and Approved Reference UI in authority.

### Current implementation

Existing components and page code show what is currently implemented.

They are not automatically canonical design authority.

When existing implementation conflicts with a higher-authority source, treat the implementation as needing correction.

Do not update this design system merely to legitimize implementation drift.

## Design Principles

1. **Clarity first**: Clean hierarchy, high contrast, explicit affordance.
2. **Semantic color**: Colors carry meaning (blue = action, red = error, green = success, amber = attention).
3. **Business-focused**: Professional, accessible, and operational-ready.
4. **Responsive by default**: All components work across mobile, tablet, and desktop.
5. **Accessible foundations**: Native semantics, keyboard navigation, focus states, and screen-reader support built in.
6. **Component-driven**: Reusable, composable, and focused components over page-local styles.

## Token Usage

Design tokens are defined in `resources/css/app.css` as CSS custom properties and reflected in Tailwind CSS theme.

### Color Tokens

Semantic colors from the reference designs:

- **Primary**: `--color-primary` - Blue (#1E40AF) for actions and active states
- **Primary Foreground**: `--color-primary-foreground` - White on primary
- **Secondary**: `--color-secondary` - Light gray for secondary actions
- **Muted**: `--color-muted` - Light gray for disabled or less prominent content
- **Destructive**: `--color-destructive` - Red (#DC2626) for errors and warnings
- **Background**: `--color-background` - White or light gray page background
- **Surface**: Implicit in card/border colors
- **Border**: `--color-border` - Light gray borders
- **Input**: `--color-input` - Form input background
- **Ring**: `--color-ring` - Focus ring color

Status-specific colors (implemented via badges and utility classes):

- **Success**: Green (#10B981) - approved bookings, completed actions
- **Warning/Attention**: Amber (#F59E0B) - pending actions, awaiting input
- **Info**: Light blue - informational alerts
- **Error**: Red (#DC2626) - conflicts, failures, destructive actions

### Typography

- **Font Family**: Instrument Sans (via Bunny Fonts), fallback to system sans-serif
- **Weights**: 400 (regular), 500 (medium), 600 (semibold)
- **Hierarchy**: Managed via Tailwind's `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.
- **Line height**: 1.5 for body text, tighter for headings

### Spacing

Uses Tailwind's default spacing scale:

- `space-1` = 0.25rem (4px)
- `space-2` = 0.5rem (8px)
- `space-3` = 0.75rem (12px)
- `space-4` = 1rem (16px)
- `space-6` = 1.5rem (24px)
- `space-8` = 2rem (32px)

### Shadows & Elevation

- **sm**: Light shadow for subtle elevation (cards)
- **md**: Medium shadow for interactive elements
- **lg**: Heavy shadow for modals and dropdowns

### Border Radius

- **sm**: `calc(var(--radius) - 4px)` - small buttons, badges
- **md**: `calc(var(--radius) - 2px)` - most cards and components
- **lg**: `var(--radius)` - large cards, modals (default 0.625rem)

## Component Hierarchy

The design system arranges UI into five layers:

```
Design Tokens (colors, spacing, typography)
       ↓
UI Primitives (Button, Input, Label, Card, etc. from Radix UI)
       ↓
Reusable Components (Alert, Badge, Breadcrumb, Dialog, etc.)
       ↓
Domain Components (BookingCard, StaffQueueTable, ConflictAlert, etc.)
       ↓
Pages (Customer home, booking flow, staff dashboard, owner settings)
```

## Accessibility Baseline

All design-system components include:

- **Native semantics**: HTML role, form elements, landmarks where applicable
- **Keyboard navigation**: Tab order, arrow keys for date/time pickers
- **Focus management**: Visible focus states (blue outline)
- **Labels and ARIA**: Associated labels for inputs, ARIA descriptions for alerts
- **Disabled states**: Visual and semantic indication
- **Color not alone**: Never rely on color alone to communicate status
- **Contrast**: Minimum WCAG AA contrast (4.5:1 for text)
- **Reduced motion**: Respects `prefers-reduced-motion` for animations
- **Touch targets**: Minimum 44px x 44px interactive elements on mobile

## Registry Rules

The UI registry (`docs/design-system/ui-registry.yaml`) tracks:

- **Primitives**: Foundational controls (Button, Input, Label, Card)
- **Components**: Reusable product UI (Alert, Badge, Dialog, Tabs)
- **Compositions**: Multi-component reusable patterns
- **Patterns**: Interaction or layout conventions (e.g., "exact-start time selection")

### Registry authority

The UI registry is a catalog of canonical implementation patterns, not an independent product-design authority.

Registry entries must have an authoritative basis in one or more of:

- A Locked Decision
- Approved Reference UI
- An already-approved design-system pattern

A registry entry must not be changed solely because current implementation differs from its approved contract.

`status: stable` means the registered implementation pattern is considered stable for reuse.

It does not mean:

- The component overrides a Locked Decision
- The component overrides Approved Reference UI
- Existing implementation has been retroactively approved
- A visual pattern is locked merely because it is widely used

If a registry entry conflicts with a higher-authority source, the registry entry is stale and must be reconciled.

### When to Register

- Register new reusable UI when you create or materially change it
- Update the registry entry when the component's purpose, props, or visual appearance changes
- Deprecate (don't delete) components that are no longer the canonical version
- Do not register arbitrary page-local fragments or one-off utility classes

### Deprecation

When a component is replaced or abandoned:

1. Mark it as `status: deprecated` in the registry
2. Note the replacement component in the `successor` field
3. Keep the deprecated entry in the registry for historical reference
4. Update consuming pages to use the replacement within one sprint

## Contribution Rules

### Before making a design-system change

Before introducing or materially changing a reusable UI pattern:

1. Read the applicable Locked Decisions.
2. Check the Reference UI manifest for applicable Approved references.
3. Inspect existing design-system patterns and tokens.
4. Determine whether the proposed change is:
    - implementation of an existing approved pattern,
    - a non-material implementation detail, or
    - a new material visual or interaction pattern.
5. If it introduces a material new canonical pattern, obtain approval before registering it as canonical.
6. Update the design system only after its authoritative basis is established.

Do not implement first and update the design system afterward solely to make the documentation match the code.

### Adding a New Reusable Component

1. Ensure the component solves a repeated problem (appears in 2+ places or 2+ reference designs)
2. Build it using primitives from `resources/js/components/ui/`
3. Use semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`, etc.)
4. Include TypeScript types for all props
5. Write one representative test case
6. Add an entry to `docs/design-system/ui-registry.yaml`
7. Document any non-obvious behavior in the component's JSDoc comment

### Modifying an Existing Component

1. Check applicable Locked Decisions.
2. Check applicable Approved Reference UI.
3. Check the registry for use sites and dependents.
4. Determine whether the requested change alters a canonical visual or interaction contract.
5. Preserve backward compatibility where it does not conflict with the approved contract.
6. If the existing component is incorrect, fix or replace it instead of preserving the defect for compatibility.
7. If the change intentionally replaces an approved pattern, update the authoritative source first.
8. Update affected registry entries and consumers.
9. Re-run applicable tests, accessibility checks, linting, and type checks.

### Styling

- Use Tailwind utility classes and semantic tokens
- Avoid inline `<style>` tags or CSS-in-JS outside of Radix UI's unstyled primitives
- Keep responsive behavior consistent (mobile-first: design for small screens first, then use `md:`, `lg:` for larger viewports)
- Never hardcode colors; use tokens

## Responsive Behavior

All components are responsive by design:

- **Mobile (default)**: Single-column, touch-friendly (44px targets), simplified forms
- **Tablet (`md`, 768px)**: Two-column layouts, larger spacing
- **Desktop (`lg`, 1024px)**: Full-width, multi-column, complex interactions
- **Large (`xl`, 1280px)**: Content-constrained for readability

Example Tailwind breakpoint usage:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* responsive grid */}
</div>
```

### Responsive authority

Responsive implementation must follow applicable Locked Decisions and Approved Reference UI.

Desktop and mobile references are separate contracts when the composition materially differs.

Do not infer an unrepresented mobile composition from a desktop reference and describe it as approved.

When a viewport is not explicitly covered by Approved Reference UI:

1. Follow applicable Locked Decisions.
2. Reuse existing approved responsive design-system patterns.
3. Preserve accessibility and touch requirements.
4. Treat the resulting composition as an implementation choice unless it is separately approved.

Tablet layouts may normally interpolate between approved mobile and desktop behavior unless a materially different composition requires explicit approval.

## Status Indicators

Reference designs use consistent visual language for status:

- **Checked in** (light blue badge): Active in-service
- **Waiting** (amber badge): Pending action or approval
- **Confirmed** (subtle badge): Locked state, awaiting time
- **Scheduling conflict** (red alert): Error state requiring resolution
- **Full capacity** (red progress bar): Over-allocated
- **Available** (green): Ready to use

These are implemented via `<Badge>` with variant props and `<Alert>` with semantic roles.

## Dark Theme

The project supports dark mode. CSS custom properties have dark variants (see `:root` and `.dark` in `resources/css/app.css`). Components automatically adapt when `.dark` class is present on the document root.

No dark-specific components are needed; use Tailwind's `dark:` prefix to override styles.

## Performance Considerations

- Components are lazy-loaded via Vite's tree-shaking
- Radix UI primitives are headless (no bundled styles, only behavior)
- Tailwind CSS is compiled to a single CSS file with PurgeCSS (unused utilities removed)
- No icons are embedded; use `lucide-react` on demand

## Validation & Quality

Validated on every commit:

- **Type checking**: TypeScript (no `any` types for UI props)
- **Linting**: ESLint + Prettier for code style
- **Component tests**: Representative tests for each primitive and common compositions
- **Visual contract**: Approved Reference UI serves as the visual baseline for the surfaces and viewports it explicitly covers.
- **Visual regression**: Automated pixel-perfect regression is not currently required, so implementation review must explicitly compare affected UI against applicable Approved Reference UI.
- **Accessibility**: Radix UI provides WCAG-compliant foundations; manually test keyboard and screen-reader scenarios

Run locally:

```bash
npm run types          # TypeScript check
npm run lint           # ESLint
npm run test           # Unit tests
npm run format:check   # Prettier
```

## Design-system change workflow

When the design system needs an update:

1. Read applicable Locked Decisions.
2. Check `docs/reference-ui/README.md` for applicable Approved Reference UI.
3. Determine whether the requested change is already authorized.
4. If a material new pattern is required, approve its authoritative basis first.
5. Update affected Reference UI when applicable.
6. Update tokens or design-system documentation.
7. Update `docs/design-system/ui-registry.yaml`.
8. Update reusable components.
9. Update page implementation.
10. Update tests.

The direction of change is:

`Approval → Reference → Design System → Implementation → Tests`

Never reverse this flow solely because existing code already behaves differently.
