# Spec 04 Approved Reference UI Manifest

**Project:** Rinquo  
**Scope:** Staff operates bookings and walk-ins  
**User approval:** `approve all`, 2026-10-11 (Asia/Manila)  
**User approval outcome:** Approved, all 17 desktop/mobile pairs, 34 core screenshots  
**Repository baseline:** `df01186a4742a50da1dc3088ba07bbc0ae2f27c4`  
**Repository registration:** Registered 2026-10-11 in `docs/reference-ui/README.md` (Spec 04 section); canonical under Decision 212.  
**Authority:** Locked Decisions → Approved Reference UI → Design System → Reusable Components → Implementation → Tests.

## Approved asset inventory

| Reference | Surface and locked visual contract | Target | Viewport | Status | Decisions | Notes |
|---|---|---|---|---|---|---|
| `desktop/01-overview.png` | Operations overview, date, counters, queue, capacity and attention | GET operations | 1600×1000 | Approved | 7, 9, 13, 46, 47, 206, 208, 211, 212 | Preserve consolidated workspace and queue-first visual hierarchy |
| `mobile/01-overview.png` | Operations overview, date, counters, queue, capacity and attention | GET operations | 390×844 | Approved | 7, 9, 13, 46, 47, 206, 208, 211, 212 | Preserve consolidated workspace and queue-first visual hierarchy |
| `desktop/02-queue.png` | Queue and focused action ordering | GET operations, mobile Queue focus | 1600×1000 | Approved | 7, 13, 33–35, 46, 47, 208 | Appointment priority and server-authorized actions |
| `mobile/02-queue.png` | Queue and focused action ordering | GET operations, mobile Queue focus | 390×844 | Approved | 7, 13, 33–35, 46, 47, 208 | Appointment priority and server-authorized actions |
| `desktop/03-booking-details.png` | Booking context and available actions | Operations contextual sheet | 1600×1000 | Approved | 9, 12, 186–196, 201 | Read-only detail panel, no new booking-details route assumed |
| `mobile/03-booking-details.png` | Booking context and available actions | Operations contextual sheet | 390×844 | Approved | 9, 12, 186–196, 201 | Read-only detail panel, no new booking-details route assumed |
| `desktop/04-check-in.png` | Staff customer arrival and check-in | POST bookings/{booking}/check-in | 1600×1000 | Approved | 9, 186–187 | Do not alter confirmed schedule |
| `mobile/04-check-in.png` | Staff customer arrival and check-in | POST bookings/{booking}/check-in | 390×844 | Approved | 9, 186–187 | Do not alter confirmed schedule |
| `desktop/05-resource-assignment.png` | Assign compatible physical resource | POST bookings/{booking}/assign | 1600×1000 | Approved | 4, 12, 186–196 | Validate capacity, resource compatibility, availability and tenant |
| `mobile/05-resource-assignment.png` | Assign compatible physical resource | POST bookings/{booking}/assign | 390×844 | Approved | 4, 12, 186–196 | Validate capacity, resource compatibility, availability and tenant |
| `desktop/06-start-service.png` | Start after check-in | POST bookings/{booking}/start | 1600×1000 | Approved | 13, 186–187, 191 | Show actual start and duration-derived ETA |
| `mobile/06-start-service.png` | Start after check-in | POST bookings/{booking}/start | 390×844 | Approved | 13, 186–187, 191 | Show actual start and duration-derived ETA |
| `desktop/07-complete-service.png` | Complete with protected buffer and audited early release | POST bookings/{booking}/complete | 1600×1000 | Approved | 188–195 | Default preserves buffer; early release requires reason |
| `mobile/07-complete-service.png` | Complete with protected buffer and audited early release | POST bookings/{booking}/complete | 390×844 | Approved | 188–195 | Default preserves buffer; early release requires reason |
| `desktop/08-create-walk-in.png` | Create walk-in in earliest safe gap | POST bookings (walk_in) | 1600×1000 | Approved | 7, 21, 33, 196 | Do not compromise scheduled capacity or create account |
| `mobile/08-create-walk-in.png` | Create walk-in in earliest safe gap | POST bookings (walk_in) | 390×844 | Approved | 7, 21, 33, 196 | Do not compromise scheduled capacity or create account |
| `desktop/09-create-booking.png` | Create a staff scheduled booking | POST bookings (scheduled) | 1600×1000 | Approved | 7, 12, 21, 33, 196 | Only approved policy exception, never capacity bypass |
| `mobile/09-create-booking.png` | Create a staff scheduled booking | POST bookings (scheduled) | 390×844 | Approved | 7, 12, 21, 33, 196 | Only approved policy exception, never capacity bypass |
| `desktop/10-reorder-queue.png` | Audited manual queue reorder | POST bookings/{booking}/reorder | 1600×1000 | Approved | 7, 34–35, 196 | Require reason and preserve appointment time |
| `mobile/10-reorder-queue.png` | Audited manual queue reorder | POST bookings/{booking}/reorder | 390×844 | Approved | 7, 34–35, 196 | Require reason and preserve appointment time |
| `desktop/11-no-show.png` | Grace-aware no-show confirmation | POST bookings/{booking}/no-show | 1600×1000 | Approved | 8, 20, 190 | Staff confirmation; verify configured grace and server guard |
| `mobile/11-no-show.png` | Grace-aware no-show confirmation | POST bookings/{booking}/no-show | 390×844 | Approved | 8, 20, 190 | Staff confirmation; verify configured grace and server guard |
| `desktop/12-block-resource.png` | Block bay and review affected scheduling | POST blocks | 1600×1000 | Approved | 12, 186–196, 201 | Impact review before apply when required |
| `mobile/12-block-resource.png` | Block bay and review affected scheduling | POST blocks | 390×844 | Approved | 12, 186–196, 201 | Impact review before apply when required |
| `desktop/13-release-block.png` | Release resource block | POST blocks/{block}/release | 1600×1000 | Approved | 12, 186–196, 201 | Do not silently adjust reservations |
| `mobile/13-release-block.png` | Release resource block | POST blocks/{block}/release | 390×844 | Approved | 12, 186–196, 201 | Do not silently adjust reservations |
| `desktop/14-delays-capacity.png` | Overruns, predictions and capacity visibility | GET operations | 1600×1000 | Approved | 13, 189, 191–195 | Overrun holds capacity until completion |
| `mobile/14-delays-capacity.png` | Overruns, predictions and capacity visibility | GET operations | 390×844 | Approved | 13, 189, 191–195 | Overrun holds capacity until completion |
| `desktop/15-notification-recovery.png` | Notification failure and retry | POST failures/{failure}/retry | 1600×1000 | Approved | 69, 88, 201 | Does not mutate booking lifecycle |
| `mobile/15-notification-recovery.png` | Notification failure and retry | POST failures/{failure}/retry | 390×844 | Approved | 69, 88, 201 | Does not mutate booking lifecycle |
| `desktop/16-realtime-offline-recovery.png` | Reconnect, stale revision, offline and recovery states | GET operations and state banners | 1600×1000 | Approved | 69, 88, 186, 201 | No offline transactional actions |
| `mobile/16-realtime-offline-recovery.png` | Reconnect, stale revision, offline and recovery states | GET operations and state banners | 390×844 | Approved | 69, 88, 186, 201 | No offline transactional actions |
| `desktop/17-owner-role-navigation.png` | Role-aware Owner shell and mobile navigation | Shared tenant shell and More | 1600×1000 | Approved | 46, 47, 201, 206, 208, 210 | Owner destinations only for authorized Owner; Staff operational-only |
| `mobile/17-owner-role-navigation.png` | Role-aware Owner shell and mobile navigation | Shared tenant shell and More | 390×844 | Approved | 46, 47, 201, 206, 208, 210 | Owner destinations only for authorized Owner; Staff operational-only |

## Supersession and inherited authority

- `03-staff-operations-dashboard.png` has an approved historical desktop baseline. The new `desktop/01-overview.png` replaces its full-page Operations composition upon canonical registration. Mark that historical reference `Superseded` in the main manifest and record `spec-04/desktop/01-overview.png` as its successor. The dark sidebar, blue primary action, queue-first hierarchy, status text, capacity and attention are preserved as approved visual language, while later Locked Decision 208 already controls the sidebar information architecture.
- Approved `owner-settings/desktop/owner-shell-desktop.png` and `owner-settings/mobile/owner-shell-mobile.png` remain Approved and are **not** superseded. Screen pair 17 applies shared Owner/Staff role-aware composition while preserving the Owner shell.
- Specs 02 and 03 remain Approved and unchanged.

## Behavioral boundaries and excluded claims

- Desktop remains one consolidated Operations workspace. Mobile may use focused Dashboard, Queue, Bookings, Walk-in, More views or anchors without creating extra desktop top-level routes.
- Screens are visual contracts only. No image authorizes a new scheduling algorithm, database change, API endpoint, employee assignment, customer self-check-in, speculative status, or unapproved business rule.
- Sample values, names, dates, prices, service catalog, counters and ETA samples are illustrative, not production data or domain authority.
- `03-booking-details` is a contextual read-only presentation of fields already in the Operations read model, not proof of a dedicated backend endpoint.
- `04-check-in` and `06-start-service` show optional review presentation; existing UI currently posts directly. Preserve lifecycle and introduce only the smallest needed confirmation change.
- `11-no-show` displays grace-aware suggestion language. The audited `OperationsBoard` currently exposes the action from scheduled start. Resolve any discrepancy against Decisions 8 and 20 before implementation.
- `16-realtime-offline-recovery` shows the target UI, not evidence WebSocket subscription is wired. Decision 69 and 88 remain binding.
- Staff never sees Owner-only Billing or Settings actions; server-side authorization must remain enforced.
- The AI exploration from the earlier Draft package was intentionally not promoted into the Approved reference set.

## Supporting review artifacts (not canonical screenshots)

- `review/boards/` four critical state boards.
- `review/comparisons/` seventeen responsive comparisons.
- `review/contact-sheet.png` entire batch.
- `review/repository-findings-and-visual-audit.md` static review and observed implementation gaps.

**Approval boundary:** The user approved the visual batch. Registration, implementation, migrations, tests, production readiness, and accessibility have not been performed by this package.
