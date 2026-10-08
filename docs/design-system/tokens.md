# Design Tokens Reference

Canonical design tokens for Rinquo, established from approved reference designs.

## Colors

All colors are defined as CSS custom properties in `resources/css/app.css` and exposed as Tailwind utilities.

### Light Theme (Default)

#### Neutrals

| Token | Value | Usage |
| --- | --- | --- |
| `--background` / `bg-background` | `#ffffff` | Page and card backgrounds |
| `--foreground` / `text-foreground` | `#1f2937` | Body text, primary foreground |
| `--card` / `bg-card` | `#ffffff` | Card backgrounds |
| `--card-foreground` / `text-card-foreground` | `#1f2937` | Text on cards |
| `--muted` / `bg-muted` | `#e5e7eb` | Disabled states, secondary backgrounds |
| `--muted-foreground` / `text-muted-foreground` | `#6b7280` | Secondary/disabled text |
| `--border` / `border-border` | `#e5e7eb` | Borders, dividers |
| `--input` / `bg-input` | `#f9fafb` | Form input backgrounds |

#### Semantic Colors

| Token | Value | Usage | Contrast |
| --- | --- | --- | --- |
| `--primary` / `bg-primary` | `#1e40af` | Button backgrounds, active states | 8.72:1 vs white |
| `--primary-foreground` / `text-primary-foreground` | `#ffffff` | Text on primary buttons | 8.72:1 on primary |
| `--secondary` / `bg-secondary` | `#f3f4f6` | Secondary button backgrounds | Surface (text pair below) |
| `--secondary-foreground` / `text-secondary-foreground` | `#1f2937` | Text on secondary | 13.34:1 on secondary |
| `--accent` / `bg-accent` | `#f3f4f6` | Accents and highlights | Surface (text pair below) |
| `--accent-foreground` / `text-accent-foreground` | `#1f2937` | Text on accents | 13.34:1 on accent |
| `--destructive` / `bg-destructive` | `#dc2626` | Error backgrounds, warnings | 4.83:1 vs white |
| `--destructive-foreground` / `text-destructive-foreground` | `#ffffff` | Text on errors | 4.83:1 on destructive |

#### Status Colors

| Token | Value | Usage | Contrast |
| --- | --- | --- | --- |
| `--success` / `bg-success` | `#047857` | Checked in, completed, available | 5.48:1 vs white |
| `--success-foreground` / `text-success-foreground` | `#ffffff` | Text on success | 5.48:1 on success |
| `--warning` / `bg-warning` | `#b45309` | Waiting, pending, attention needed | 5.02:1 vs white |
| `--warning-foreground` / `text-warning-foreground` | `#ffffff` | Text on warning | 5.02:1 on warning |
| `--success-text` / `text-success-text` | `#065f46` | Text on 10% success tints (StatusChip, status panels) | 6.67:1 on a success tint over white, 6.32:1 over the page tint |
| `--warning-text` / `text-warning-text` | `#92400e` | Text on 10% warning tints | 6.19:1 on a warning tint over white, 5.86:1 over the page tint |
| `--info` / `bg-info` | `#2563eb` | Informational alerts, status updates | 5.17:1 vs white |
| `--info-foreground` / `text-info-foreground` | `#ffffff` | Text on info | 5.17:1 on info |

#### Component-Specific

| Token | Value | Usage |
| --- | --- | --- |
| `--ring` | `#3b82f6` | Focus rings, focus states |
| `--popover` | `#ffffff` | Dropdown and popover backgrounds |
| `--popover-foreground` | `#1f2937` | Text in popovers |

#### Sidebar (Dark Theme)

| Token | Value | Usage |
| --- | --- | --- |
| `--sidebar` | `#001f3f` | Sidebar background |
| `--sidebar-foreground` | `#ffffff` | Sidebar text |
| `--sidebar-primary` | `#3b82f6` | Sidebar active button |
| `--sidebar-primary-foreground` | `#ffffff` | Text on active sidebar button |
| `--sidebar-accent` | `#1e40af` | Sidebar accent color |
| `--sidebar-accent-foreground` | `#ffffff` | Text on sidebar accent |
| `--sidebar-border` | `#003d6b` | Sidebar dividers |
| `--sidebar-ring` | `#3b82f6` | Sidebar focus ring |

### Dark Theme

When `.dark` class is present on document root:

| Token | Light Value | Dark Value | Usage |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#111827` | Inverted backgrounds |
| `--foreground` | `#1f2937` | `#f9fafb` | Inverted text |
| `--card` | `#ffffff` | `#1f2937` | Inverted cards |
| `--primary` | `#1e40af` | `#60a5fa` | Lighter blue for contrast |
| `--success` | `#047857` | `#34d399` | Lighter green; 8.62:1 with `#001f3f` text |
| `--warning` | `#b45309` | `#fbbf24` | Lighter amber; 9.92:1 with `#001f3f` text |
| `--destructive` | `#dc2626` | `#f87171` | Lighter red for contrast |
| `--info` | `#2563eb` | `#60a5fa` | Light blue; 6.52:1 with `#001f3f` text |

**Sidebar remains dark navy in both themes** for visual consistency (branding).

## Typography

Defined in Tailwind CSS theme in `resources/css/app.css`.

### Font Family

```css
--font-sans: 'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
```

Served via Bunny Fonts (privacy-friendly alternative to Google Fonts).

**Weights available**: 400 (regular), 500 (medium), 600 (semibold)

### Type Scale

Uses Tailwind's default sizes:

| Class | Size | Line Height | Usage |
| --- | --- | --- | --- |
| `text-xs` | 12px | 1.5 | Labels, captions, badges |
| `text-sm` | 14px | 1.5 | Secondary text, helper text |
| `text-base` | 16px | 1.5 | Body text, form inputs |
| `text-lg` | 18px | 1.75 | Subheadings |
| `text-xl` | 20px | 1.75 | Section headings |
| `text-2xl` | 24px | 2 | Page titles |
| `text-3xl` | 30px | 2.2 | Large headings |

### Font Weights

| Class | Weight | Usage |
| --- | --- | --- |
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Form labels, secondary buttons |
| `font-semibold` | 600 | Headings, strong emphasis |

## Spacing

Uses Tailwind's default spacing scale (4px base):

| Class | Value | Usage |
| --- | --- | --- |
| `space-1` / `gap-1` | 4px | Minimal spacing |
| `space-2` / `gap-2` | 8px | Tight spacing, badge padding |
| `space-3` / `gap-3` | 12px | Form field spacing |
| `space-4` / `gap-4` | 16px | Default spacing, padding |
| `space-6` / `gap-6` | 24px | Section spacing, card padding |
| `space-8` / `gap-8` | 32px | Large section gaps |
| `space-12` / `gap-12` | 48px | Major section separation |

Padding and margin use the same scale: `p-4`, `m-4`, `px-6`, `pt-8`, etc.

## Sizing

### Border Radius

| Token | Value | Usage |
| --- | --- | --- |
| `--radius` | `0.625rem` (10px) | Large cards, modals |
| `--radius-lg` | `0.625rem` (10px) | Same as `--radius` |
| `--radius-md` | `0.375rem` (6px) | Cards, badges |
| `--radius-sm` | `-0.375rem` | Small buttons (unused) |

Tailwind utilities:
```css
rounded-sm   /* 2px */
rounded      /* 4px */
rounded-md   /* 6px */
rounded-lg   /* 8px */
rounded-full /* 9999px (circles) */
```

### Shadows

| Class | Box-shadow | Usage |
| --- | --- | --- |
| `shadow-sm` | Light | Card hover, subtle elevation |
| `shadow` | Medium | Cards, standard elevation |
| `shadow-md` | Medium-heavy | Interactive elements, buttons on hover |
| `shadow-lg` | Heavy | Modals, dropdowns |

## Responsive Breakpoints

Mobile-first approach. Style for small screens first, then add breakpoints for larger:

| Breakpoint | Width | Prefix | Usage |
| --- | --- | --- | --- |
| None (default) | 0px | (no prefix) | Mobile/small devices |
| `sm` | 640px | `sm:` | Larger phones, small tablets |
| `md` | 768px | `md:` | Tablets |
| `lg` | 1024px | `lg:` | Laptops |
| `xl` | 1280px | `xl:` | Desktops |
| `2xl` | 1536px | `2xl:` | Large desktops |

**Example**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column on mobile, 2 on tablet, 3 on desktop */}
</div>
```

## Focus & Interaction States

### Focus Rings

All interactive elements have visible focus rings (WCAG AA):

```css
focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
}
```

Tailwind utility: `focus-visible:outline focus-visible:ring-2`

### Button States

| State | Background | Text | Cursor |
| --- | --- | --- | --- |
| Default | `--primary` | `--primary-foreground` | pointer |
| Hover | Darker blue | White | pointer |
| Active (pressed) | Darker blue | White | pointer |
| Focus | Same + ring | Same | pointer |
| Disabled | `--muted` | `--muted-foreground` | not-allowed |

## Dark Mode

Enable by adding `class="dark"` to `<html>` or `<body>`.

All components automatically adapt via CSS custom properties and Tailwind's `dark:` prefix.

Example component:
```tsx
<div className="bg-background text-foreground dark:bg-background dark:text-foreground">
  {/* Automatically uses light/dark theme */}
</div>
```

## Using Tokens in Code

### In Tailwind Classes

```tsx
// Colors
<div className="bg-primary text-primary-foreground">
<div className="bg-destructive text-destructive-foreground">
<div className="bg-success text-success-foreground">
<div className="bg-warning text-warning-foreground">
<div className="bg-info text-info-foreground">
<div className="border border-border">

// Spacing
<div className="p-4 gap-6 mt-8">

// Typography
<h1 className="text-2xl font-semibold text-foreground">
<p className="text-base text-muted-foreground">

// Focus states
<button className="focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring">

// Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### In CSS

```css
.my-component {
    background: var(--background);
    color: var(--foreground);
    border: 1px solid var(--border);
}

.my-component:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
}
```

## Accessibility Considerations

- **Contrast**: All text colors meet WCAG AA standard (4.5:1 for body text)
  - Primary (#1e40af) on white: 8.72:1
  - Success (#047857) on white: 5.48:1
  - Warning (#b45309) on white: 5.02:1
  - Info (#2563eb) on white: 5.17:1
  - Destructive (#dc2626) on white: 4.83:1
- **Color not alone**: Status always indicated by text + color, not color alone
- **Focus visible**: All interactive elements have visible focus rings
- **Disabled state**: Both color and pointer style indicate disabled state
- **Dark mode**: All colors have dark theme equivalents for readability

## Component Variants

Actual implemented variants:

### Button
- default (primary blue)
- destructive (red)
- outline (border)
- secondary (gray)
- ghost (transparent)
- link (text-only)

### Badge
- default (primary blue)
- secondary (gray)
- destructive (red)
- outline (border)

**Note**: Alert and Badge do not have built-in success/warning/info variants.
To use status colors for these components, use custom className overrides or
implement variants as they're needed in feature development.

## Future Additions

Tokens added as patterns emerge:

- Success/warning/info variants for Alert and Badge (when patterns are established)
- Spacing variants for density (compact, comfortable, spacious)
- Motion tokens if animation patterns are standardized
- Layer/z-index tokens for stacking context
