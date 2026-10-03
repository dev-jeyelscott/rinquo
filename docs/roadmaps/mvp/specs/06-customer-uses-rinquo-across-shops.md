# 06. Customer Uses Rinquo Across Shops

## Working outcome

A verified customer can use a neutral Rinquo account across multiple businesses without exposing one tenant's activity to another.

## Users

Customer

## Applicable implementation areas

- Platform-wide customer profile and saved vehicles.
- Neutral customer shell for directory, cross-shop bookings, vehicles, and profile.
- Business directory search by business name and city/municipality.
- Owner-controlled directory opt-in.
- Tenant-branded shop context when entering a specific business.
- Strict separation of shared identity from tenant-scoped activity.
- Verified email-change flow with notification to old email.

## Acceptance criteria

- Customer sees their own bookings across shops.
- A tenant sees only its relationship/activity with that customer.
- Directory excludes tenants that did not opt in while direct booking URLs still work.
- Saved vehicles are shared only through the verified platform identity.
- Staff-entered unverified email cannot expose or mutate a platform customer account.

## Verification requirements

- Cross-tenant authorization tests.
- Customer ownership tests for profile, vehicles, and bookings.
- Directory visibility/search tests.
- Email-change verification tests.
- UI tests for neutral platform vs tenant-branded context.

## Material risks

- Shared identity increases the impact of authorization mistakes.
- Weak branding boundaries can confuse platform and tenant context.

## Implementation Context Prompt

Inspect the approved platform-customer identity decisions and branding boundaries first. Implement one verified customer identity across shops while keeping tenant activity strictly organization-scoped. Use a neutral platform shell for directory, bookings, vehicles, and profile, and tenant branding only within a selected business context. Prevent unverified staff-entered email from claiming or exposing a platform account. Treat cross-tenant isolation tests as release blockers. Strictly and explicitly follow the required rules and deliverables.
