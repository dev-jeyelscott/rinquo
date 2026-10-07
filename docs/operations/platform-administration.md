# Platform administration

A separate identity, guard, session cookie and shell for operating the SaaS. Platform
administrators are never tenant users and cannot be promoted from or into them.

## First administrator

```bash
docker compose -p rinquo -f compose.production.yaml exec web php artisan platform:bootstrap-admin you@example.com --name="Your Name"
```

The password is read from a hidden prompt (never an argument) and never printed. The command does
nothing once any administrator exists. At first sign-in the administrator enrolls an authenticator
app (time-based, 6 digits) and receives **10 single-use recovery codes, shown once**.

## Adding and removing administrators

`/platform/admins`: invite by email (single-use link, expires in 72 hours, stored as a digest), reset
a factor, disable or re-enable. Every one of these asks for the password **and** a fresh authenticator
code. Disabling signs the person out everywhere, removes their factor and recovery codes, ends any live
support session and revokes their pending invitations in one transaction. Re-enabling restores no
factor.

## Sessions

12-hour absolute and 30-minute inactivity limits; every request re-checks that the administrator is
active and the session generation is current. Email password reset changes the password only: it never
signs in and never bypasses the second factor.

## Support access (read-only)

`/platform/organizations` → an organization → "View as this member". Needs a reason (10+ characters), a
support/ticket reference and step-up. The session is bound to **one organization** and **one active
Owner or Staff member**, lasts **30 minutes**, cannot be extended, and shows a persistent banner with an
exit. Only allowlisted read views exist (overview with the member's own policy applied, pending booking
requests without customer contact details). Every other method or path is refused before any controller
runs. Every view and every blocked attempt is recorded in `platform_audit_events`. Mutating access is out
of scope and would need a separately approved action list plus second-operator approval.

## Plan terms

`/platform/plan-terms`: publish an immutable, effective-dated version of the global price, trial and grace
(grace default is 3 days). Past versions never change; new terms apply to new renewal requests and trials
from the effective time; issued requests, paid periods and recorded dates keep their snapshots. A database
trigger forbids editing or deleting a version.

## Failed jobs

`/platform/failed-jobs`: redacted list (class, queue, exception class, time). Retry one job at a time, only
for classes listed in `config/rinquo.php` → `platform.retryable_jobs`, with step-up. To make a class
retryable, prove its handler is idempotent and add it with a one-line reason in the same change as its tests.

## Audit

`platform_audit_events` is append-only (a database trigger rejects every row update and delete) and kept
indefinitely. Rows hold actor and subject ids, event, result, route name, correlation id and an allowlist of
metadata keys: never secrets, codes, request bodies or customer data.
