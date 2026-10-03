# Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Concurrent bookings exceed capacity | Critical | Transactional revalidation, atomic holds, idempotency, DB constraints/locking strategy |
| Aggregate availability appears valid but no physical resource can fulfill | Critical | Schedule against individual physical-resource feasibility |
| Tenant data leakage | Critical | Mandatory organization scoping, policies, query tests, authorization tests |
| Shared customer identity leaks cross-shop activity | Critical | Separate shared profile from tenant-owned activity and tenant authorization |
| Configuration change breaks future bookings | High | Impact preview, snapshots, automatic reassignment, explicit conflicts |
| Resource shutdown disrupts confirmed appointments | High | Same-time reassignment first, then staff conflict workflow |
| Service overrun causes downstream delay | High | Actual timestamps, continued capacity consumption, ETA recalculation, >5-minute delay notification |
| Duplicate booking submission | High | Idempotency key plus capacity validation |
| Failed email causes operational confusion | Medium | Queue retries/backoff, persistent delivery status, staff operational failure view |
| Subscription restriction blocks valid existing work | High | Allow existing bookings to operate through completion |
| Non-renewal accidentally triggers deletion | High | Separate restriction state from explicit organization closure |
| Audit table growth | Medium | Append-only semantics now, archive/partition later only when justified |
| Single VPS outage | Medium | Managed DB/Redis, daily backups + PITR, staging, uptime/error monitoring, documented recovery |
