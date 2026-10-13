# Spec 07: Static UI audit (reviewed before approval)

21 desktop/mobile pairs rendered at **1600×1000 / 390×844**. Each comparison includes the matching full-size pair. Quality gates inspect static imagery; they do not execute the real app.

| Check | Result | Notes |
|---|---|---|
| Reference count / viewport dimensions | PASS | 42 PNGs with exactly specified dimensions |
| Owner desktop primary Billing | PASS | Separate sidebar destination, no eighth Settings tab |
| Owner mobile Billing | PASS | Five tabs, More active for Billing screens |
| Platform Admin separate shell | PASS | 20–21 use platform navigation instead of tenant Owner nav |
| Hierarchy, legibility and responsive stacking | PASS, visually | Main status, action, deadline and supporting guidance visible |
| Status semantics | PASS | Text + color; no payment success before webhook confirmation |
| QR/request expiry distinct | PASS | Separate refs 05, 06 and 07, demo QR nonpayable |
| Trial vs paid grace boundary | BACKEND BLOCKER | Approved design follows Decision 100; code differs |
| Automatic 24-hour request regeneration | BACKEND GAP | Safe manual recovery shown but automation not implemented |
| Existing-booking protection | PASS | 13 operations and 14 storefront restriction state only |
| Closure typed confirmation | PASS, visually | 16 has empty confirmation and disabled destructive button |
| Admin publish step-up | PASS, visually | 21 includes password + authenticator OTP inputs |
| Closure recovery end / support guidance | PASS | 17–19 are distinct states; no automatic deletion claims |
| Keyboard / screen reader / focus trap / polling | UNVERIFIED | Static screenshots cannot validate runtime behavior |
| Approved owner reference pixel parity | UNVERIFIED | Approved image binaries not retrievable via text connector |

## Implementation follow-up quality gates

Verify exact trial boundaries and paid grace; never over-grant access based on existing tests. Add idempotent automated request regeneration without provider churn or double-payment risk. Confirm authorized Owner / Staff / cross-tenant 403/404, webhook replay and late settlement, mobile keyboard and focus, expiry times and reduced motion. Do not treat a static reference as evidence that those tests passed.

**Supersession:** none. All 42 PNGs were user-approved on 2026-10-13. Repository registration is still pending.
