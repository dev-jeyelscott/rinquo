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
