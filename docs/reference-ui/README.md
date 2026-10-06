# Reference UI Screens

1. 01-customer-shop-home.png
2. 02-booking-schedule.png
3. 03-staff-operations-dashboard.png
4. 04-scheduling-conflict-resolution.png
5. 05-owner-scheduling-configuration.png

These screens implement the approved representative UI patterns only. They are reference designs, not application implementation.

## Authority

Approved references sit directly below locked decisions in the authority order: **locked decisions → approved reference UI → design system/tokens/registry → reusable components → page implementation/tests** (see `docs/planning-decisions.md` → Authority order). Design-system rules, components, and pages conform to these references; a reference is never edited to match existing code. Changing an approved reference requires explicit approval recorded first, then downward propagation.

## Visual lock status

| Reference | Status |
| --- | --- |
| 01-customer-shop-home.png | Approved representative reference |
| 02-booking-schedule.png | Approved representative reference |
| 03-staff-operations-dashboard.png | Approved representative reference |
| 04-scheduling-conflict-resolution.png | Approved representative reference |
| 05-owner-scheduling-configuration.png | Approved representative reference for the desktop Owner scheduling configuration screen only |
| Owner mobile settings shell | **Not yet visually locked** (no approved reference) |

Each reference locks only the screen and viewport it shows. `05-owner-scheduling-configuration.png` is a 1600×1000 desktop image and does not lock the Owner mobile settings shell.

### Owner mobile settings shell: why it is unlocked

- Decision 44 requires a responsive PWA that feels native.
- Decision 46 requires a desktop sidebar plus mobile bottom navigation for Staff.
- No approved Owner-mobile reference resolves the composition: navigation, destinations, safe-area behavior, and how Owner-only configuration relates to operational navigation.
- The current `owner-shell.tsx` behavior (compact small-screen top bar) is existing implementation, not approval.

### Gate to lock it

A new approved Owner-mobile reference must explicitly define the composition and its relevant responsive states. Only after it is approved and listed here may the design system, registry, and implementation be updated to match it. Do not add a local responsive workaround in the meantime.
