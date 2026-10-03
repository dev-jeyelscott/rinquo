# Design System

Canonical UI design system for Rinquo, established from approved reference designs.

## Source of Truth

- **Design Tokens**: CSS custom properties in `resources/css/app.css` (Tailwind CSS theme configuration)
- **UI Primitives**: `resources/js/components/ui/` (Radix UI + Tailwind CSS components)
- **UI Registry**: `docs/design-system/ui-registry.yaml` (canonical reusable components)
- **Reference Designs**: `docs/reference-ui/` (visual specifications for approved patterns)

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

### Adding a New Reusable Component

1. Ensure the component solves a repeated problem (appears in 2+ places or 2+ reference designs)
2. Build it using primitives from `resources/js/components/ui/`
3. Use semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`, etc.)
4. Include TypeScript types for all props
5. Write one representative test case
6. Add an entry to `docs/design-system/ui-registry.yaml`
7. Document any non-obvious behavior in the component's JSDoc comment

### Modifying an Existing Component

1. Check the registry for its use sites and dependents
2. Ensure changes are backward-compatible when possible
3. If breaking: update the registry with version info, file an issue to migrate consumers
4. Re-run tests and lint

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
- **Visual regression**: Reference designs serve as the visual spec (no automated pixel-perfect testing)
- **Accessibility**: Radix UI provides WCAG-compliant foundations; manually test keyboard and screen-reader scenarios

Run locally:
```bash
npm run types          # TypeScript check
npm run lint           # ESLint
npm run test           # Unit tests
npm run format:check   # Prettier
```

## Questions or Updates?

When the design system needs an update:

1. Check the registry and reference designs for precedent
2. If the change affects multiple components or introduces new tokens, file a task under the Design System epic
3. Use the `design-system` skill to update the canonical system and registry
4. Do not make design changes in page code without first updating the system
