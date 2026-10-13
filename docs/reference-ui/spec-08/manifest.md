# Spec 08: Platform Administration and Operational Recovery

## Approved Reference UI manifest

**Status:** **Approved by user on 2026-10-13 (Asia/Manila)** for all 23 desktop/mobile pairs, 46 main PNGs, under Decision 212. The approved files are prepared for repository registration; approval is not a claim that they are committed or deployed.  
**Verified repository revision:** `952b6f9b9a6e552a1b0a4fac67e3975add5335ff` (main, 2026-10-13).  
**Reference sizes:** Desktop 1600 × 1000, Mobile 390 × 844.  
**Approval scope:** The user explicitly approved all 23 numbered screens at both 1600 × 1000 and 390 × 844 viewports by replying `approve all` on 2026-10-13 (Asia/Manila). No additional route or unrendered interaction is approved by implication.  
**Authority:** Locked Decisions → Approved Reference UI → Design System → Reusable Components → Implementation → Tests.  
**Supersession:** None requested or proposed. Spec 07 Platform Plan Terms and Publish are intentionally excluded.

## Exact screen inventory

| # | State / filename | Actual route | Desktop | Mobile | Decisions | Status |
|---|---|---|---|---|---|---|
| 01 | platform-sign-in | `/platform/login` | [01 desktop](desktop/01-platform-sign-in.png) | [01 mobile](mobile/01-platform-sign-in.png) | 63, 211, 212 | Approved |
| 02 | authenticator-verification | `/platform/mfa` | [02 desktop](desktop/02-authenticator-verification.png) | [02 mobile](mobile/02-authenticator-verification.png) | 63, 211, 212 | Approved |
| 03 | recovery-code-alternative | `/platform/mfa` | [03 desktop](desktop/03-recovery-code-alternative.png) | [03 mobile](mobile/03-recovery-code-alternative.png) | 63, 211, 212 | Approved |
| 04 | authenticator-enrollment | `/platform/enroll` | [04 desktop](desktop/04-authenticator-enrollment.png) | [04 mobile](mobile/04-authenticator-enrollment.png) | 63, 211, 212 | Approved |
| 05 | one-time-recovery-codes | `/platform/recovery-codes` | [05 desktop](desktop/05-one-time-recovery-codes.png) | [05 mobile](mobile/05-one-time-recovery-codes.png) | 63, 211, 212 | Approved |
| 06 | session-ended | `/platform/login` | [06 desktop](desktop/06-session-ended.png) | [06 mobile](mobile/06-session-ended.png) | 63, 211, 212 | Approved |
| 07 | forgot-password | `/platform/forgot-password` | [07 desktop](desktop/07-forgot-password.png) | [07 mobile](mobile/07-forgot-password.png) | 63, 211, 212 | Approved |
| 08 | password-reset | `/platform/reset-password/{token}` | [08 desktop](desktop/08-password-reset.png) | [08 mobile](mobile/08-password-reset.png) | 63, 211, 212 | Approved |
| 09 | invitation-acceptance | `/platform/invitations/{token}` | [09 desktop](desktop/09-invitation-acceptance.png) | [09 mobile](mobile/09-invitation-acceptance.png) | 62, 63, 211, 212 | Approved |
| 10 | invitation-unavailable | `/platform/invitations/{token}` | [10 desktop](desktop/10-invitation-unavailable.png) | [10 mobile](mobile/10-invitation-unavailable.png) | 62, 63, 211, 212 | Approved |
| 11 | platform-overview | `/platform` | [11 desktop](desktop/11-platform-overview.png) | [11 mobile](mobile/11-platform-overview.png) | 62, 66, 83, 211, 212 | Approved |
| 12 | organization-directory | `/platform/organizations` | [12 desktop](desktop/12-organization-directory.png) | [12 mobile](mobile/12-organization-directory.png) | 62, 64, 211, 212 | Approved |
| 13 | organization-details | `/platform/organizations/{organization}` | [13 desktop](desktop/13-organization-details.png) | [13 mobile](mobile/13-organization-details.png) | 62, 64, 211, 212 | Approved |
| 14 | start-support-session | `/platform/organizations/{organization}` | [14 desktop](desktop/14-start-support-session.png) | [14 mobile](mobile/14-start-support-session.png) | 64, 65, 211, 212 | Approved |
| 15 | support-overview | `/platform/support/{supportSession}` | [15 desktop](desktop/15-support-overview.png) | [15 mobile](mobile/15-support-overview.png) | 64, 65, 211, 212 | Approved |
| 16 | support-booking-requests | `/platform/support/{supportSession}/booking-requests` | [16 desktop](desktop/16-support-booking-requests.png) | [16 mobile](mobile/16-support-booking-requests.png) | 64, 65, 211, 212 | Approved |
| 17 | support-expired | `/platform/organizations/{organization}` | [17 desktop](desktop/17-support-expired.png) | [17 mobile](mobile/17-support-expired.png) | 64, 65, 211, 212 | Approved |
| 18 | administrator-directory | `/platform/admins` | [18 desktop](desktop/18-administrator-directory.png) | [18 mobile](mobile/18-administrator-directory.png) | 62, 63, 65, 211, 212 | Approved |
| 19 | administrator-access-change | `/platform/admins` | [19 desktop](desktop/19-administrator-access-change.png) | [19 mobile](mobile/19-administrator-access-change.png) | 62, 63, 65, 211, 212 | Approved |
| 20 | regenerate-recovery-codes | `/platform/security` | [20 desktop](desktop/20-regenerate-recovery-codes.png) | [20 mobile](mobile/20-regenerate-recovery-codes.png) | 63, 65, 211, 212 | Approved |
| 21 | failed-job-monitoring | `/platform/failed-jobs` | [21 desktop](desktop/21-failed-job-monitoring.png) | [21 mobile](mobile/21-failed-job-monitoring.png) | 65, 68, 83, 211, 212 | Approved |
| 22 | safe-job-retry | `/platform/failed-jobs` | [22 desktop](desktop/22-safe-job-retry.png) | [22 mobile](mobile/22-safe-job-retry.png) | 65, 68, 83, 211, 212 | Approved |
| 23 | retry-result-and-history | `/platform/failed-jobs` | [23 desktop](desktop/23-retry-result-and-history.png) | [23 mobile](mobile/23-retry-result-and-history.png) | 65, 68, 83, 211, 212 | Approved |

## Per-screen boundary, reusable pattern and state coverage

The route below is the existing route. A modal, error or confirmation remains a state of that route and does not imply a new URL or server feature. All visible names, amounts, email addresses and dates are fictional; codes/secrets are masked.

### 01. platform-sign-in

- **Route:** `/platform/login`. **Product family:** Identity.
- **Supported state:** Password challenge, no public enrollment.
- **Boundary:** Password step only. An authenticated Platform Admin session is NOT established.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Empty, invalid credentials, pending, email reset link.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [01 desktop/mobile](review-support/comparisons/01-platform-sign-in-comparison.png).

### 02. authenticator-verification

- **Route:** `/platform/mfa`. **Product family:** Identity.
- **Supported state:** Six-digit authenticator challenge.
- **Boundary:** Existing /platform/mfa code path; wrong/replayed code remains rejected.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Incomplete six digits, invalid/replayed code, pending, recovery alternative.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [02 desktop/mobile](review-support/comparisons/02-authenticator-verification-comparison.png).

### 03. recovery-code-alternative

- **Route:** `/platform/mfa`. **Product family:** Identity.
- **Supported state:** Single-use alternative factor.
- **Boundary:** Existing alternate recovery-code toggle on /platform/mfa, not a new URL.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Used code, empty input, retry rate limits.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [03 desktop/mobile](review-support/comparisons/03-recovery-code-alternative-comparison.png).

### 04. authenticator-enrollment

- **Route:** `/platform/enroll`. **Product family:** Identity.
- **Supported state:** First sign-in / factor reset enrollment.
- **Boundary:** Existing enrollment route; secret deliberately masked in reference image.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Masked setup key, unconfirmed factor, invalid code.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [04 desktop/mobile](review-support/comparisons/04-authenticator-enrollment-comparison.png).

### 05. one-time-recovery-codes

- **Route:** `/platform/recovery-codes`. **Product family:** Identity.
- **Supported state:** One-time secure presentation; illustrative masking.
- **Boundary:** Existing one-time authenticated presentation; all illustrated codes are masked.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** One-time presentation, save warning, continue.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [05 desktop/mobile](review-support/comparisons/05-one-time-recovery-codes-comparison.png).

### 06. session-ended

- **Route:** `/platform/login`. **Product family:** Identity.
- **Supported state:** 12-hour absolute or 30-minute idle sign-out.
- **Boundary:** An expired/idle/revoked reason is shown on /platform/login, no standalone expired route.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Idle, absolute expiry, revoked.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [06 desktop/mobile](review-support/comparisons/06-session-ended-comparison.png).

### 07. forgot-password

- **Route:** `/platform/forgot-password`. **Product family:** Identity.
- **Supported state:** Non-enumerating password reset request.
- **Boundary:** Non-enumerating forgot-password request; no disclosure of registered email.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Non-enumerating response, network error.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [07 desktop/mobile](review-support/comparisons/07-forgot-password-comparison.png).

### 08. password-reset

- **Route:** `/platform/reset-password/{token}`. **Product family:** Identity.
- **Supported state:** Password reset does not complete second factor.
- **Boundary:** Reset-password form; does not sign in or bypass authenticator challenge.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Expired token, field validation, mismatch, confirmation.
- **Locked Decisions:** 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [08 desktop/mobile](review-support/comparisons/08-password-reset-comparison.png).

### 09. invitation-acceptance

- **Route:** `/platform/invitations/{token}`. **Product family:** Identity.
- **Supported state:** 72-hour single-use invitation acceptance.
- **Boundary:** Only existing single-use 72-hour invitation acceptance, followed by factor enrollment.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Usable invite, validation, pending.
- **Locked Decisions:** 62, 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [09 desktop/mobile](review-support/comparisons/09-invitation-acceptance-comparison.png).

### 10. invitation-unavailable

- **Route:** `/platform/invitations/{token}`. **Product family:** Identity.
- **Supported state:** Invalid, expired, or used invitation.
- **Boundary:** Invalid/expired/used token is a state of invitation URL, not a new route.
- **Reusable design pattern:** AuthCard, TextField, SubmitButton, Alert; platform shell signed out.
- **Critical states considered:** Revoked, already used, expired.
- **Locked Decisions:** 62, 63, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [10 desktop/mobile](review-support/comparisons/10-invitation-unavailable-comparison.png).

### 11. platform-overview

- **Route:** `/platform`. **Product family:** Platform.
- **Supported state:** Failed jobs, plan terms, admins, active support.
- **Boundary:** Existing overview shows failed-job count, active administrators, plan terms, live support session; not comprehensive infrastructure health.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, TextField, StepUpDialog.
- **Critical states considered:** 0 / >0 retained failed jobs, active support.
- **Locked Decisions:** 62, 66, 83, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [11 desktop/mobile](review-support/comparisons/11-platform-overview-comparison.png).

### 12. organization-directory

- **Route:** `/platform/organizations`. **Product family:** Platform.
- **Supported state:** Search, entitlement status, paging / empty results.
- **Boundary:** Name/address search, status chips and pagination; no customer listing or unauthorized tenant search.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, TextField, StepUpDialog.
- **Critical states considered:** Search results, empty results, pagination.
- **Locked Decisions:** 62, 64, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [12 desktop/mobile](review-support/comparisons/12-organization-directory-comparison.png).

### 13. organization-details

- **Route:** `/platform/organizations/{organization}`. **Product family:** Platform.
- **Supported state:** Status and eligible owner/staff members.
- **Boundary:** Organization detail shows allowed status and ACTIVE owner/staff members. No tenant mutation.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, TextField, StepUpDialog.
- **Critical states considered:** Eligible members, no eligible members.
- **Locked Decisions:** 62, 64, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [13 desktop/mobile](review-support/comparisons/13-organization-details-comparison.png).

### 14. start-support-session

- **Route:** `/platform/organizations/{organization}`. **Product family:** Platform.
- **Supported state:** Reason, reference, target, password + OTP step-up.
- **Boundary:** Dialog on organization detail. Requires target, 10+ character reason, support reference, current password, current authenticator code.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, TextField, StepUpDialog.
- **Critical states considered:** Missing reason/reference, invalid step-up, pending, network failure.
- **Locked Decisions:** 64, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [14 desktop/mobile](review-support/comparisons/14-start-support-session-comparison.png).

### 15. support-overview

- **Route:** `/platform/support/{supportSession}`. **Product family:** Support.
- **Supported state:** Owner- or staff-scoped read model + session banner.
- **Boundary:** Read-only support overview. Staff target omits Owner-only subscription/readiness detail.
- **Reusable design pattern:** SupportBanner, SectionCard, StatusChip, Button; strict read-only.
- **Critical states considered:** Owner vs Staff target role, countdown, exit.
- **Locked Decisions:** 64, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [15 desktop/mobile](review-support/comparisons/15-support-overview-comparison.png).

### 16. support-booking-requests

- **Route:** `/platform/support/{supportSession}/booking-requests`. **Product family:** Support.
- **Supported state:** Redacted read-only tenant booking requests.
- **Boundary:** Only allowlisted booking request fields. Customer contacts/notes and approve/decline are absent.
- **Reusable design pattern:** SupportBanner, SectionCard, StatusChip, Button; strict read-only.
- **Critical states considered:** List, empty state, privacy, pagination.
- **Locked Decisions:** 64, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [16 desktop/mobile](review-support/comparisons/16-support-booking-requests-comparison.png).

### 17. support-expired

- **Route:** `/platform/organizations/{organization}`. **Product family:** Support.
- **Supported state:** Expired/denied session redirects to organization details.
- **Boundary:** 30-minute expiry redirects to existing organization detail with a flash. No new support-expiry route.
- **Reusable design pattern:** SupportBanner, SectionCard, StatusChip, Button; strict read-only.
- **Critical states considered:** Expired, blocked, redirect, end confirmation.
- **Locked Decisions:** 64, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [17 desktop/mobile](review-support/comparisons/17-support-expired-comparison.png).

### 18. administrator-directory

- **Route:** `/platform/admins`. **Product family:** Security.
- **Supported state:** Active/disabled admins + pending invitations.
- **Boundary:** Existing admin management directory, invite and revoke. Invitation is single-use, 72 hours.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, StepUpDialog.
- **Critical states considered:** Invitation sent, invitations empty, active/disabled.
- **Locked Decisions:** 62, 63, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [18 desktop/mobile](review-support/comparisons/18-administrator-directory-comparison.png).

### 19. administrator-access-change

- **Route:** `/platform/admins`. **Product family:** Security.
- **Supported state:** Disable / enable / factor reset via step-up.
- **Boundary:** An existing confirmation dialog on /platform/admins. Disable/re-enable/reset-factor each require step-up; no unapproved bulk action.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, StepUpDialog.
- **Critical states considered:** Disable confirmation, reset factor, re-enable, pending, failure.
- **Locked Decisions:** 62, 63, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [19 desktop/mobile](review-support/comparisons/19-administrator-access-change-comparison.png).

### 20. regenerate-recovery-codes

- **Route:** `/platform/security`. **Product family:** Security.
- **Supported state:** Sensitive factor recovery rotation, one-time display.
- **Boundary:** Existing /platform/security and step-up modal. New codes are shown only once on existing /platform/recovery-codes.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, StepUpDialog.
- **Critical states considered:** Step-up, rotation warning, one-time code presentation.
- **Locked Decisions:** 63, 65, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [20 desktop/mobile](review-support/comparisons/20-regenerate-recovery-codes-comparison.png).

### 21. failed-job-monitoring

- **Route:** `/platform/failed-jobs`. **Product family:** Failures.
- **Supported state:** Safe metadata and explicit eligibility.
- **Boundary:** Redacted failed_jobs projection. At this HEAD ONLY ProcessWebhookEvent is allowlisted.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, StepUpDialog.
- **Critical states considered:** Failed jobs, no failures, allowlist eligibility, pagination.
- **Locked Decisions:** 65, 68, 83, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [21 desktop/mobile](review-support/comparisons/21-failed-job-monitoring-comparison.png).

### 22. safe-job-retry

- **Route:** `/platform/failed-jobs`. **Product family:** Failures.
- **Supported state:** Single-job retry + step-up; eligible jobs only.
- **Boundary:** Dialog on /platform/failed-jobs; single UUID, verified class, password + TOTP. No bulk retry.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, StepUpDialog.
- **Critical states considered:** Step-up, claimed concurrently, network failure, pending.
- **Locked Decisions:** 65, 68, 83, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [22 desktop/mobile](review-support/comparisons/22-safe-job-retry-comparison.png).

### 23. retry-result-and-history

- **Route:** `/platform/failed-jobs`. **Product family:** Failures.
- **Supported state:** Queued != complete; dispatch failure recovery.
- **Boundary:** Post-action state within /platform/failed-jobs. Queued != handler completed; dispatch failure retains job.
- **Reusable design pattern:** PlatformShell, SectionCard, StatusChip, StepUpDialog.
- **Critical states considered:** Claimed, queued, dispatch failure, retry history.
- **Locked Decisions:** 65, 68, 83, 211, 212. **Status:** Approved. **Supersedes:** None.
- **Comparison:** [23 desktop/mobile](review-support/comparisons/23-retry-result-and-history-comparison.png).

## Supporting review artifacts

- `review-support/review/spec-08-contact-sheet.png`: all 23 side-by-side pairs in one overview.
- `review-support/comparisons/`: one full desktop/mobile comparison image for every pair.
- `review-support/critical-states/01`–`05`: workflow visual sequence boards assembled from the approved main PNGs.
- `review-support/critical-states/06`–`10`: additional critical-state samples including errors, denied access, pending actions, failed retries, and external operations boundaries. These are **not new routes**.
- `review-support/review/repository-findings.md`: verified repository evidence and current implementation boundaries.
- `review-support/review/visual-and-security-audit.md`: visual audit, accessibility checklist, security review, limitations and remaining gaps.

## Explicit exclusions

No new audit explorer, release/deployment console, Sentry UI, log viewer, Kubernetes console, backup restoration wizard or arbitrary tenant impersonation flows. The existing Spec 07 `/platform/plan-terms` and its publication confirmation are outside the approved Spec 08 screen inventory. Unrendered screen interactions are not approved by association.

## Reference fidelity and implementation disclosure

The actual approved Spec 07 PNG pixel content could not be retrieved for direct side-by-side visual sampling through the read-only GitHub connector, although its manifest, established tokens and relevant implementation components were inspected. The user approved this batch with that comparison still unverified; compare the exact Spec 07 PNGs before claiming pixel-level parity during implementation. Runtime browser tests and deployment verification were not run; visual approval is not test certification.

## Registration and scope

The 46 main PNG files under `desktop/` and `mobile/` are approved visual contracts **only after the matching `Approved` entries are registered in `docs/reference-ui/README.md` in the repository**. The `review-support/` artifacts provide review evidence, not additional canonical routes or screen approvals. The rasterized `DRAFT DESIGN` / `ILLUSTRATIVE DATA` footer in the approved PNGs is a rendering artifact and not part of the locked application interface. No previously approved references are superseded.
