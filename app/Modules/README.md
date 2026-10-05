# Modules

Rinquo is a modular monolith (ADR 0001). Each business domain lives in its own
folder here, for example `app/Modules/Scheduling/`, and is created only when the
vertical slice that owns it begins. Do not add empty or speculative modules.

## Conventions

- One folder per domain module, namespaced `App\Modules\<Module>`.
- Cross-cutting, domain-free code belongs in `app/Support/`. `App\Support` must
  never depend on `App\Modules` (enforced by an architecture test).
- A module owns its models, actions, policies, jobs, events and tests for its
  domain. Other modules use its public classes, not its internals.
- Tenant-owned data is organization-scoped (ADR 0002).

## Time

- Absolute instants are stored and processed in UTC. The application and the
  PostgreSQL session timezone are both UTC.
- Use `timestampTz()` / `timestampsTz()` (PostgreSQL `timestamptz`) for new
  columns, never naive `timestamp` columns.
- `config('app.display_timezone')` (`Asia/Manila`) is only for presenting
  instants to people. In the browser, format with `resources/js/lib/datetime.ts`
  and the shared `displayTimezone` prop.

## Current modules

| Module       | Owns                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Identity`   | Verified email identities and Owner email-code sign-in (challenges, rate limits, the sign-in mail).                                                                                           |
| `Tenancy`    | Organization, its one branch, memberships and the Owner policy, tenant media, audit events, publish/unpublish, storefront.                                                                    |
| `Scheduling` | Booking-feasibility configuration: hours, catalog, resources, capacity consumption, the Owner booking policy and the shared readiness evaluator.                                              |
| `Booking`    | Availability search, temporary checkout holds, bookings and their immutable snapshots, the customer wizard, approval of pending requests, booking email and the expiry and reminder sweepers. |

Boundaries:

- `Tenancy` is the tenant root. Every scheduling-critical write goes through
  `Tenancy\Actions\ChangeOrganization`, which locks the organization row,
  runs the change, appends audit events and unpublishes a published
  organization that stops being ready.
- `Scheduling\Readiness\ReadinessEvaluator` is the single readiness rule
  set. The Owner checklist, Publish, critical mutations and the public
  storefront all call it; nothing keeps a stored "ready" flag.
- Composite `(organization_id, id)` foreign keys make PostgreSQL reject a row
  that references another tenant's parent record.
- Slice 01 publishes a catalog only. Slice 02 (`Booking`) consumes the
  variants, windows, branch calendar, resource capacities and consumption
  rules defined here.
- `Booking` lock order: every capacity claim, conversion, approval and expiry
  locks the `organizations` row `FOR UPDATE` first (the lock
  `ChangeOrganization` uses, so configuration changes and claims serialize per
  tenant), then the affected hold or booking, re-reads configuration and
  occupancy, verifies and writes in one transaction with no network calls.
- Live capacity claims are active unexpired holds, confirmed bookings and
  unexpired pending-approval bookings. Expiry is a time predicate, so capacity
  frees at the expiry instant before any sweeper runs. A claim fits ONE
  physical resource (a variant's consumption rules are alternative resource
  types); capacity is never aggregated across resources.
- Booking snapshot columns are immutable (a PostgreSQL trigger); status, the
  planned resource assignment and notification timestamps stay mutable.
  Later slices extend `bookings.status`, the `policy_snapshot` keys and
  `Booking\Support\BookingIntake` additively.
- A signed-in customer shares the `web` guard and the `users` identity with
  Owners (ADR 0004); a booking attaches only to the verified, signed-in user.
