# Spec 08: Visual, security and implementation-boundary review

**Draft review date:** October 13, 2026. **Repository revision:** `952b6f9b`. **Outcome:** Draft package rendered; not approved.

## Per-family design audit

| Family | Screens | Hierarchy and desktop/mobile approach | Critical states and security invariant | Draft risk |
|---|---|---|---|---|
| Authentication | 01–10 | Neutral signed-out shell; centered constrained desktop form, full-width mobile card | Wrong factor, password pending, 2FA, single-use recovery, expiration, generic reset | Do not promote masked secrets into implementation placeholders; verify actual keyboard focus in code |
| Overview/organizations | 11–14 | Current horizontal platform navigation; readable cards, search and member selection | Count != health, authorized member, reason/reference, step-up | Sample amounts/people fictitious; adjust after direct Approved PNG visual comparison |
| Tenant support | 15–17 | Persistent session banner; staff-only read model; separate mobile status cards | Role-scoping, field redaction, 30-minute expiry, blocked attempted writes, explicit exit | Countdown must not obscure mobile viewport; no UI for blocked mutations |
| Administrator security | 18–20 | Administrator directory and invitation section, carefully scoped destructive modal | Step-up, revoke sessions/factor, 72-hour invites, one-time codes | Re-enable/factor-reset variants are in supplemental boards, not extra routed pages |
| Operational failures | 21–23 | Desktop redacted table, stacked mobile job details and status history | Only ProcessWebhookEvent retryable at current HEAD; claimed/queued/dispatch_failed; no payload | Eligibility must remain server-driven; a queued job is not a completed business operation |

## Consistency, accessibility, state review

- [x] All 46 main images use the requested dimensions: 1600×1000 desktop and 390×844 mobile.
- [x] Desktop content centered within the existing neutral Platform shell. Mobile primary navigation remains the current wrapped platform links, not invented tenant bottom navigation.
- [x] Primary, success, warning, destructive, border and navy tokens align with the repository's documented light-theme palette.
- [x] One consistent typographic scale, labeled fields, clear secondary actions and red destructive confirmation.
- [x] Mobile data tables visually become labeled rows and dense cards; no deliberate horizontal table overflow.
- [x] All recovery codes, OTPs and authenticator setup secrets are masked illustrative placeholders. No real secrets used.
- [x] Tenant support banner explicitly identifies read-only, organization, role, member, reference and remaining time; exit remains visible.
- [x] Customer contact details and notes do not appear in support booking requests.
- [x] No bulk retry, uncontrolled impersonation, raw job payload, exception message, backup wizard, audit explorer or unrelated infrastructure dashboard.
- [x] Each of 23 main pairs has its own comparison PNG; 10 review-only critical-state/workflow boards plus one all-pair contact sheet.

## Unresolved matters before `approve all`

1. **Visual authority parity:** Approved Spec 07 platform PNG binaries were not accessible via the read-only GitHub connector. The approved manifest and tokens were read, but direct pixel-level visual parity with its Plan Terms screens still requires human review before approval.
2. **Implementation is not tested:** The static drafts are not proof of React behavior, keyboard focus management, screen-reader announcements, scrolling under dynamic content or live backend integration. These are required implementation verification tasks, not reasons to invent additional routes.
3. **Selected-state coverage:** Some error, pending, empty and permission states appear on supporting state boards rather than in all 46 main reference screenshots. Approvals should distinguish their illustrative status.
4. **Mobile viewport framing:** Reference PNGs show only the first 844px viewport. Below-the-fold content should scroll in the eventual web application. The screenshots do not imply truncation or hiding.
5. **Sample data:** No demo name, business email, price, job count, ticket, timestamp, or recovery token illustration defines a product requirement.

## Excluded from app screens, kept in operational review

External GitHub CI/CD, monitoring via Sentry and uptime, managed PostgreSQL PITR, encrypted backup dumps, restore drills, second-operator approval, runbook-driven incident response. Supporting board `10-operational-recovery-boundaries.png` is noncanonical and **not** a `/platform` feature proposal.

## Decision

No new product decision appears necessary to proceed to draft visual review. The scope is already locked. All PNGs remain **Draft** under Decision 212 until explicit user approval per viewport/state; no approved Spec 07 reference is superseded.
