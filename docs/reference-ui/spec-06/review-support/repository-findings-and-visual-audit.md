# Repository Findings and Visual QA

**Inspected:** 2026-10-12; verified HEAD `b55947bbcd291422d257f471aa1b153c62ce1a6d` using connected GitHub access. **Mode:** strictly read-only. No code changes, server tests or browser E2E tests were run against Rinquo.

## Verified implementation

- `routes/web.php`: neutral `/account/auth/login`, `/account/directory`, `/account/bookings`, `/account/vehicles`, `/account/profile`, profile/vehicle mutations, email-change endpoints, and `/shops/{slug}` storefront already exist.
- `resources/js/layouts/customer-shell.tsx`: neutral header with horizontal links only; Decision 45 requires five icon-only, individually labeled bottom tabs on mobile.
- `CustomerAuthController`: email request and six-digit verification exist. No customer auth restart endpoint is present in the inspected route/controller.
- `CustomerAccountController.directory`: opt-in + published, accepting bookings and readiness filtering, name/city matching, first 50 shops. The UI projection only returns `name`, `city`, `url`. Logo, photos, services, starting prices and hours need a concrete, authorized read-model change before richer cards can be implemented.
- `CustomerAccountController.bookings`: online-source bookings attached by `customer_user_id`, displayed with organization name, city, time, status and shop booking URL. Staff-entered emails alone do not establish platform ownership.
- `CustomerAccountController.vehicles`: lists active user-owned vehicles; create and archive supported, no edit endpoint. Archive uses explicit `user_id` ownership check.
- `CustomerAccountController.profile`: name/phone, email-change-pending session state. `ChangeCustomerEmail` verifies the new address under a transaction, rejects duplicates, rate limits requests and attempts to notify the previous email after commit. Email notification failure is reported but does not roll back the completed change.
- `TenantShopShell` and `shops/show.tsx`: the shop retains its own limited branding and inherited tenant storefront. Screen 06 does not change an Approved shop design.
- `docs/decision.md`, `docs/planning-decisions.md`, applicable ADRs, Reference UI manifests for Specs 02, 03 and 05, design system and Spec 06 acceptance criteria were read. GitHub code search returned no test-file matches, so the current test inventory was not independently enumerated.

## Material implementation/UI gaps

| Priority | Gap | Draft resolution / implementation dependency |
|---|---|---|
| P0 | Missing Decision 45 five-tab mobile customer navigation | Render five icon-only bottom tabs with individually accessible names, 44×44 target/visible focus and active state; Home and Book cannot silently conflict on a route. |
| P0 | Missing Decision 78 directory business data | Extend authorized DTO/read model using existing tenant profile, service, pricing, hours and media sources; enforce explicit owner opt-in and booking-readiness filters. |
| P1 | Unclear recovery from expired or invalid email-change code | Display the failure; add/reuse a safe restart operation only after independently specifying it. Current pending-session state cannot be assumed to allow a new request. |
| P1 | Weak customer account loading/error/offline feedback | Differentiate valid zero results from network failure, preserve user inputs and disable unsafe mutations offline. |
| P1 | Missing archive confirmation in existing vehicle page | Confirm before existing archive POST, then communicate the confirmed server result. |
| P1 | Directory/home navigation intent | Home uses existing directory landing; Book is the search/discovery action. Mapping is draft UI guidance, not an approved new customer dashboard. |
| P1 | Email-change notification not guaranteed delivered | Distinguish successful address change from asynchronous/after-commit notification outcome; assess retry/recovery separately. |

## Visual constraints checked

- 17 distinct paired screens at exactly **1600×1000 desktop** and **390×844 mobile**.
- Neutral customer branding for account/auth/directory/bookings/vehicles/profile. Tenant brand confined to screen 06 context sample.
- Palette derives from `docs/design-system/tokens.md`: primary `#1e40af`, dark/navy `#001f3f`, neutral text and border, success `#047857`, warning `#b45309`, error `#dc2626`. The typography and spacing reference Instrument Sans, 4px-based rhythm, rounded cards, visible control boundaries.
- Mobile five-icon nav is visibly present in the rendered account screens. Production semantics, keyboard/touch testing and focus traps have **not** been executed.
- No maps, GPS, star ratings, reviews, favorites, promotion cards, speculative vehicle edit, or appointment-capacity UI in the canonical mockups.
- Mobile screenshots intentionally capture the **initial 390×844 viewport**; below-the-fold portions require scrolling in the real implementation. Do not infer screenshot cropping as approved hidden content.
- Brand imagery is locally drawn illustration, not a real wash business photograph. All names, prices, hours, vehicles, dates, photos and account details are fictitious review placeholders.
- Supporting `states` and `boards` show supplementary scenarios only, not a tested network or server response.

## Remaining risks and implementation quality gates

1. **Data integrity/security:** Customer account is global but bookings remain organization-scoped. Directory projection and shop media must not bypass tenant checks; staff-entered unverified emails must not claim identities.
2. **Privacy:** Avoid disclosing customer email to tenants outside the relationship. Sensitive OTPs must never appear in logs or page fixtures.
3. **Operational correctness:** Confirmation UX must not optimistically claim a vehicle was archived or an address changed before the server acknowledges it.
4. **Recovery:** OTP throttling, expiry, resend/restart, request failure, stale session and duplicate email need explicit QA acceptance after implementation.
5. **Usability:** The fixed bottom tab bar must leave enough safe-area and scroll padding; all icon-only controls need accessible labels and visible focus states.
6. **Release gates:** Backend ownership/tenant-isolation tests, network/error frontend tests, Playwright responsive and keyboard tests, and deployment verification remain outside this design-only batch.

**Audit outcome:** Draft visual coverage complete. No runtime feature, automated tests, repository registration, or Approved UI status claimed.
