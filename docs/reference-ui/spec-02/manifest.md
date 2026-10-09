# Spec 02 Approved Reference Manifest

**Overall status: Approved (2026-10-08)**. User approved the entire Spec 02 batch. These references are registered as canonical in `docs/reference-ui/README.md`.

| File | Surface / state | Route / state | Viewport | Status | Locked Decisions | Existing Approved reference affected | Supersession relationship | Supersedes | Superseded by | Approved visual lock | Exclusions | Implementation notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `desktop/01-vehicle.png` | Vehicle | `/shops/{slug}/book` / vehicle | 1600×1000 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | None directly | Unchanged | None | None | Vehicle-type choices and make/model field | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `mobile/01-vehicle.png` | Vehicle | `/shops/{slug}/book` / vehicle | 390×844 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Vehicle-type choices and make/model field | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `desktop/02-service.png` | Service + add-ons | `/shops/{slug}/book` / service | 1600×1000 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | None directly | Unchanged | None | None | Service and add-on choice cards, price/duration breakdown | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `mobile/02-service.png` | Service + add-ons | `/shops/{slug}/book` / service | 390×844 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Service and add-on choice cards, price/duration breakdown | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `desktop/03-schedule.png` | Schedule | `/shops/{slug}/book` / schedule | 1600×1000 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | None directly | Unchanged | None | None | Exact-start date/time selection, disabled times, next available | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `mobile/03-schedule.png` | Schedule | `/shops/{slug}/book` / schedule | 390×844 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | 02-booking-schedule.png | Historical `02-booking-schedule.png` is Superseded in `docs/reference-ui/README.md` | `02-booking-schedule.png` | None | Exact-start date/time selection, disabled times, next available | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `desktop/04-details.png` | Customer details | `/shops/{slug}/book/holds/{hold}/details` / details | 1600×1000 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | None directly | Unchanged | None | None | Guest contact form, held-time feedback and notes | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `mobile/04-details.png` | Customer details | `/shops/{slug}/book/holds/{hold}/details` / details | 390×844 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Guest contact form, held-time feedback and notes | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `desktop/05-email-verification.png` | Email verification | `/shops/{slug}/book/holds/{hold}/details` / email-verification | 1600×1000 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | None directly | Unchanged | None | None | Six-digit OTP, resend cooldown and held-time feedback | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Signed-in visitors bypass OTP |
| `mobile/05-email-verification.png` | Email verification | `/shops/{slug}/book/holds/{hold}/details` / email-verification | 390×844 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Six-digit OTP, resend cooldown and held-time feedback | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Signed-in visitors bypass OTP |
| `desktop/06-confirm.png` | Review and confirm | `/shops/{slug}/book/holds/{hold}/confirm` / confirm | 1600×1000 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | None directly | Unchanged | None | None | Review, edit actions and hold-aware confirmation | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Pending mode uses Send booking request |
| `mobile/06-confirm.png` | Review and confirm | `/shops/{slug}/book/holds/{hold}/confirm` / confirm | 390×844 | Approved | 3, 23-26, 28, 44, 49-52, 57-61, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Review, edit actions and hold-aware confirmation | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Pending mode uses Send booking request |
| `desktop/07-booking-confirmed.png` | Booking confirmed | `/shops/{slug}/bookings/{booking}` / booking-confirmed | 1600×1000 | Approved | 14, 57-60, 203, 211, 212 | None directly | Unchanged | None | None | Confirmed result, details and safe next action | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `mobile/07-booking-confirmed.png` | Booking confirmed | `/shops/{slug}/bookings/{booking}` / booking-confirmed | 390×844 | Approved | 14, 57-60, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Confirmed result, details and safe next action | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `desktop/08-request-sent.png` | Request sent | `/shops/{slug}/bookings/{booking}` / request-sent | 1600×1000 | Approved | 14, 57-60, 203, 211, 212 | None directly | Unchanged | None | None | Pending-approval status, deadline and next action | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |
| `mobile/08-request-sent.png` | Request sent | `/shops/{slug}/bookings/{booking}` / request-sent | 390×844 | Approved | 14, 57-60, 203, 211, 212 | 01-customer-shop-home.png (tenant language) | Unchanged | None | None | Pending-approval status, deadline and next action | No back-end changes; no resource, buffer or capacity exposure; sample content not locked | Sample data; design only |

## What this approval locks

- Shared tenant-branded booking visual language, 5-stage progress pattern, summaries, core step layouts, selection states, buttons, and the responsive mobile/desktop compositions pictured.
- **Vehicle**: vehicle-type radio cards and make/model collection, saved-vehicle composition only when signed-in and data exists.
- **Service**: compatible primary-service card, optional add-on card, visible price/duration deltas.
- **Schedule**: visible disabled times, exact start, date strip, Next available, time selection; approved replacement for original reference 02 mobile.
- **Details + OTP**: details field treatment, held-time timer, visible 6-digit code and resend cooldown; verified signed-in customers bypass OTP.
- **Confirm**: breakdown, edit affordances, temporary hold and submit busy state.
- **Results**: separately marked confirmed vs pending, no claim of successful email delivery.

## Excluded from lock

- Synthetic shop name/logo, service catalog/prices, customer identity, example booking IDs, time/date fixtures.
- Booking algorithms, resource matching, transaction semantics, idempotency implementation and capacity data.
- Server/controller behavior, routes, DB schema or unrelated Spec 01/03/Owner/Staff/Billing surfaces.
- Error/success behavior not shown in core images; treat supporting state boards as patterns, not additional canonical pages.
- Arbitrary other viewport breakpoints, font rasterization differences, and browser chrome.

## Implementation notes and outstanding issues

1. Physical capacity and buffer remain internal. Approval of the visual omission does not authorize backend scheduling changes.
2. Add model/make field only after contract reconciliation with Locked Decision 23 and current form/backend.
3. Mobile screenshots are **initial viewport** 390×844. Long forms scroll under a fixed safe-area-aware CTA, not hidden.
4. Approval explicitly supersedes `02-booking-schedule.png` for the mobile Schedule visual contract. The original PNG is kept for historical reference and is marked Superseded in `docs/reference-ui/README.md`.
5. Use existing semantic design tokens and tenant contrast logic; examples use safe blue tone.
6. Dynamic data, login, OTP delivery, business-hours feasibility and countdown updates must be wired to existing server contracts during later implementation.
7. Only source-corroborated behavior should be treated as implemented. The screenshots are designed fixtures.

## Supporting references (approved as UX state patterns; not standalone canonical screens)

- `states/desktop-critical-states.png`: 14 recovery state patterns.
- `states/mobile-critical-states.png`: 14 mobile-constrained recovery states.
- `review/`: paired comparison sheets 01–08.
