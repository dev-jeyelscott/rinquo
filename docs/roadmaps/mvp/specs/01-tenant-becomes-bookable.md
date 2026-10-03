# 01. Tenant Becomes Bookable

## Working outcome

An Owner can create an organization, configure the minimum operational model, pass readiness checks, and explicitly publish a tenant booking page.

## Users

Owner

## Applicable implementation areas

- Email OTP Owner authentication with expiry, resend cooldown, rate limiting, and persistent sessions.
- Organization plus one active branch, business profile, branding, photos, weekly hours, and date overrides.
- Vehicle types, services, service/vehicle variants, add-ons, service windows, resource types, physical resources, capacities, and capacity-consumption rules.
- Owner-only authorization for scheduling-critical configuration.
- Readiness checklist and explicit Publish action.
- Tenant-branded public shop page with unpublished/unavailable states.
- Audit logging for create, update, and delete actions.

## Acceptance criteria

- No tenant accepts bookings until readiness passes and Owner clicks Publish.
- Missing service + vehicle + resource consumption configuration makes that combination unavailable.
- Staff cannot mutate Owner-only configuration.
- Resources/services referenced by history are archived or deactivated instead of deleted.
- UTC timestamps display using the branch timezone.

## Verification requirements

- Readiness and Publish-gating feature tests.
- Owner vs Staff authorization tests.
- Tenant-isolation tests for organization-owned configuration.
- Capacity/compatibility validation tests.
- UI tests for empty, validation, disabled, unpublished, and success states.

## Material risks

- Partial configuration can expose impossible booking combinations.
- Authorization gaps could let Staff alter critical scheduling behavior.

## Implementation Context Prompt

Inspect the authoritative planning documents and approved reference UI first. Implement the smallest production-ready vertical slice that lets an Owner configure one branch and explicitly publish a bookable tenant. Preserve organization scoping, Owner-only scheduling configuration, integer capacity semantics, audit logging, readiness gating, archive-not-delete history rules, and UTC storage with Asia/Manila display. Include focused frontend, backend, persistence, authorization, validation, tests, and documentation only for this outcome. Do not introduce multi-branch, worker scheduling, native apps, microservices, or marketplace features. Strictly and explicitly follow the required rules and deliverables.
