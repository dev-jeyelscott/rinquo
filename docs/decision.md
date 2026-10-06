# Booking SaaS Planning Decisions

## Project

Web/mobile-based SaaS booking and operations platform for car and motorcycle wash/detailing shops.

## Planning Status

- Decisions captured: **1–200**
- Current project mode: **Fresh project**
- Planning approach: **Decision-driven discovery, later accelerated to up to 5 questions per round**
- Decision discovery status: **Effectively complete**
- Next planning phase: **Planning documents → reference UI → vertical roadmap/specs → quality gate → final ZIP**
- Important unresolved items: **None currently identified**
- Last resolved decision: **Decision 200, customer actions during tenant restriction**

---

## Product Scope and Core Model

### Decision 1 — Product scope

**Decision:** SaaS from day one.

Multiple independent wash/detailing businesses can use the same platform with tenant isolation.

### Decision 2 — Branch support in MVP

**Decision:** One active branch per organization in MVP.

The architecture still keeps `organization -> branch -> resources` so multi-branch support can be enabled later.

### Decision 3 — Customer account model

**Decision:** Guest-first progressive account creation.

Use **email OTP first**. Avoid requiring registration before booking. SMS OTP may be added later if a practical provider is available.

### Decision 4 — Capacity reservation

**Decision:** Reserve a **resource type/capacity**, not a specific bay, during booking.

The actual physical bay is assigned later.

### Decision 5 — Service duration

**Decision:** Duration is based on **service + vehicle type**.

Example: the same service may take different time for a motorcycle, sedan, SUV, etc.

### Decision 6 — Booking interval

**Decision:** Default booking start interval is **15 minutes**, configurable per organization/branch.

Actual occupied duration still follows the selected service and vehicle type.

### Decision 7 — Bookings vs walk-ins

**Decision:** Hybrid priority.

Bookings reserve capacity around their scheduled time. Walk-ins fill available gaps.

### Decision 8 — Late-arrival grace period

**Decision:** Configurable per organization/branch.

Default: **15 minutes**.

### Decision 9 — Customer check-in

**Decision:** Staff-only check-in for MVP.

Customers cannot self-check-in.

### Decision 10 — Cancellation and rescheduling

**Decision:** Customer self-service with a configurable cutoff.

After the cutoff, staff intervention is required.

### Decision 11 — Deposits

**Decision:** No customer booking deposits in MVP.

Architecture should allow optional deposits later.

### Decision 12 — Staff assignment

**Decision:** Resource/bay scheduling only.

Individual worker assignment is not part of MVP scheduling.

### Decision 13 — Queue ETA

**Decision:** Simple duration-based ETA for MVP.

Use remaining duration of active work plus scheduled durations ahead. Store actual timestamps for future ETA improvements.

### Decision 14 — Customer notifications

**Decision:** Email only for MVP.

Notifications include confirmation, upcoming turn, service started, delays, and ready-for-pickup.

### Decision 15 — Service buffer

**Decision:** Configurable buffer per service.

The buffer consumes scheduling capacity but does not have to be shown as service duration to the customer.

### Decision 16 — Multiple services

**Decision:** One primary service + optional add-ons.

### Decision 17 — Add-on resource behavior

**Decision:** Add-ons extend the same reserved resource.

No multi-resource booking requirement in MVP.

### Decision 18 — Business hours

**Decision:** Weekly business hours + date-specific overrides/closures.

### Decision 19 — Booking window

**Decision:** Configurable per organization/branch.

Default assumptions:

- Maximum advance booking: **30 days**
- Minimum booking notice: **1 hour**

### Decision 20 — No-show handling

**Decision:** System auto-suggests no-show after the grace period, but staff must confirm.

### Decision 21 — Walk-in capacity protection

**Decision:** No fixed walk-in capacity reserve in MVP. **Resolved by Decision 196.**

Walk-ins use genuinely available gaps while confirmed appointment capacity remains protected. Do not introduce dedicated walk-in capacity reservation in MVP.

### Decision 22 — Payment handling for customer services

**Decision:** No in-app customer service payment handling in MVP.

### Decision 23 — Vehicle details

**Decision:** Require vehicle type + make/model.

Plate number is optional.

### Decision 24 — Saved vehicles

**Decision:** Automatically save vehicles for verified customers.

### Decision 25 — Service pricing

**Decision:** Price varies by **service + vehicle type**.

### Decision 26 — Service/vehicle compatibility

**Decision:** Explicit compatibility rules.

Unsupported service + vehicle combinations are hidden/unavailable.

### Decision 27 — Tenant staff roles

**Decision:** MVP roles are:

- Owner
- Staff

More granular roles can be added later.

### Decision 28 — Tenant branding

**Decision:** Business name + logo + basic brand colors.

No full page builder or theme system in MVP.

### Decision 29 — Public booking URL

**Decision:** Shared domain + organization slug.

Example: `app.example.com/johns-auto-spa`.

---

## Resources, Queue, and Scheduling

### Decision 30 — Resource configuration

**Decision:** Named physical resources.

Examples:

- Wash Bay 1
- Wash Bay 2
- Detailing Bay
- Motorcycle Bay

### Decision 31 — Actual bay assignment

**Decision:** Staff manually selects the actual bay/resource when service is about to start.

### Decision 32 — Temporary resource unavailability

**Decision:** Support both:

- Time-range blocks
- Full-day blocks

Implement as one resource blocking capability with an “All day” option.

### Decision 33 — Walk-in scheduling

**Decision:** Walk-ins receive the earliest compatible available slot.

### Decision 34 — Manual queue override

**Decision:** Staff may reorder the queue only with:

- Required reason
- Audit log

### Decision 35 — Queue priority categories

**Decision:** No explicit priority categories in MVP.

Use normal scheduling rules plus audited manual override.

---

## Tenancy and Authentication

### Decision 36 — Tenant data isolation

**Decision:** Shared PostgreSQL database and shared schema.

Tenant-owned records are scoped by `organization_id`.

### Decision 37 — Staff authentication

**Decision:** Email + 6-digit OTP, no password.

Require:

- OTP expiry
- Resend cooldown
- Rate limiting
- Persistent sessions

### Decision 38 — Business onboarding

**Decision:** Self-service organization signup by the Owner.

### Decision 39 — SaaS subscription payment

**Decision:** Businesses manually pay using a **system-generated PayMongo QR Ph** payment request.

Payment confirmation should rely on PayMongo webhook confirmation, not uploaded payment screenshots.

### Decision 40 — Subscription plan structure

**Decision:** One flat monthly plan for MVP.

### Decision 41 — Subscription expiry

**Decision:** Configurable grace period, then restricted/read-only tenant state.

### Decision 42 — Public page after subscription lock

**Decision:** Keep the page online but disable new bookings and show a “temporarily unavailable” state.

### Decision 43 — Initial market

**Decision:** Philippines-only MVP.

Assume:

- PHP currency
- Philippine address/contact formats
- `Asia/Manila`
- PayMongo / QR Ph

---

## PWA and UI/UX

### Decision 44 — Mobile strategy

**Decision:** Responsive PWA only for MVP.

It must visually feel like a native mobile app.

### Decision 45 — Customer mobile navigation

**Decision:** Five icon-only bottom tabs:

- Home
- Book
- Bookings
- Vehicles
- Profile

Each icon still requires accessible labels.

### Decision 46 — Staff navigation

**Decision:** Desktop sidebar + mobile bottom navigation.

### Decision 47 — Staff mobile tabs

**Decision:**

- Dashboard
- Queue
- Bookings
- Walk-in
- More

### Decision 48 — Customer home focus

**Decision:** Conversion-first.

Show business branding, open/closed status, next available slot, and a strong **Book Now** CTA.

### Decision 49 — Booking flow

**Decision:** Step-by-step wizard:

1. Vehicle
2. Service
3. Schedule
4. Details
5. Confirm

### Decision 50 — Schedule UI

**Decision:** Calendar + available time chips.

Also provide a “Next available” shortcut.

### Decision 51 — Unavailable time display

**Decision:** Show unavailable slots as disabled instead of hiding them.

### Decision 52 — Meaning of selected booking time

**Decision:** Customer selects an **exact planned service start time**.

### Decision 53 — Protecting appointment times

**Decision:** Protect booked appointment capacity aggressively.

Do not start walk-ins that would reasonably jeopardize the next confirmed booking.

### Decision 54 — Service overrun

**Decision:** If an in-progress service overruns, automatically delay the next booking when necessary and notify the customer.

### Decision 55 — Delay notification threshold

**Decision:** Notify once predicted delay exceeds **5 minutes**.

### Decision 56 — Pre-arrival reminder

**Decision:** Enabled by default and configurable.

Default reminder: **30 minutes before the expected start**. If ETA has shifted, use the updated expected start.

### Decision 57 — Booking confirmation mode

**Decision:** Configurable per organization:

- Auto-confirm
- Staff approval required

### Decision 58 — Default confirmation mode

**Decision:** Auto-confirm by default.

### Decision 59 — Pending booking expiry

**Decision:** Pending bookings auto-expire after a configurable timeout.

Default: **15 minutes**.

### Decision 60 — Pending capacity hold

**Decision:** Pending bookings temporarily reserve capacity.

### Decision 61 — Booking concurrency

**Decision:** First successful booking transaction wins the final available slot.

Availability must be atomically revalidated before confirmation.

---

## Platform Administration and Audit

### Decision 62 — Platform Admin

**Decision:** Dedicated Platform Admin role, separate from tenant Owners.

### Decision 63 — Platform Admin authentication

**Decision:** Email + password + mandatory 2FA.

### Decision 64 — Platform Admin tenant access

**Decision:** Read-only tenant access by default.

Audited impersonation is allowed only when explicitly needed and must require a reason.

### Decision 65 — Audit logging scope

**Decision:** Audit every create, update, and delete action across tenant and platform data.

### Decision 66 — Audit retention

**Decision:** Keep audit logs indefinitely.

Prefer append-only semantics and allow future archival/partitioning if volume grows.

---

## Application Architecture and Operations

### Decision 67 — Application architecture

**Decision:** Laravel modular monolith + Inertia/React PWA.

Core infrastructure:

- Laravel
- React / TypeScript
- PostgreSQL
- Redis
- Queues
- Reverb

### Decision 68 — Background jobs

**Decision:** Background jobs primarily for outbound notifications, including OTP/reminder delivery.

PayMongo webhook handling and booking state transitions remain synchronous/idempotent. Scheduled commands may detect expirations/reminders and dispatch jobs.

### Decision 69 — Staff real-time updates

**Decision:** WebSocket real-time updates.

### Decision 70 — Customer live status

**Decision:** Real-time customer booking status page.

Possible states include:

- Confirmed
- Checked In
- Delayed
- In Service
- Completed

### Decision 71 — Customer identity across businesses

**Decision:** Platform-wide customer identity.

A customer can use one verified account across multiple shops.

### Decision 72 — Customer profile ownership

**Decision:** Shared core profile + tenant-scoped activity.

Shared:

- Name
- Email
- Saved vehicles

Tenant-scoped:

- Bookings
- Shop-specific activity/history

### Decision 73 — Customer app scope

**Decision:** Platform-wide customer app.

Customers can see bookings across shops, saved vehicles, and profile, while each tenant only sees its own relationship with the customer.

---

## Business Discovery / Marketplace

### Decision 74 — Business discovery scope

**Decision:** Support direct links, searchable businesses, and later marketplace discovery.

### Decision 75 — Marketplace rollout

**Decision:** Phased.

MVP:

- Direct shop links
- Searchable business directory

Later:

- Nearby shops
- Ratings
- Filters
- Promotions
- Marketplace ranking/discovery

### Decision 76 — Directory search

**Decision:** Search by business name + city/municipality.

No GPS/map requirement in MVP.

### Decision 77 — Directory visibility

**Decision:** Business Owner explicitly opts into public directory listing.

Direct booking URL works regardless.

### Decision 78 — Directory listing content

**Decision:** Show:

- Business name
- City/municipality
- Logo
- Services
- Starting prices
- Business hours
- Booking CTA

### Decision 79 — Business photos

**Decision:** Logo + up to **5 business photos**.

### Decision 80 — Visual direction

**Decision:** Clean modern SaaS + native-app feel.

Tenant branding influences customer-facing screens without fragmenting the design system.

---

## Infrastructure, Reliability, and Development

### Decision 81 — Deployment model

**Decision:** Dockerized application on one VPS + managed PostgreSQL + managed Redis.

### Decision 82 — Database backups

**Decision:** Daily automated backups + PostgreSQL PITR.

### Decision 83 — Monitoring

**Decision:** Structured logs + error tracking + uptime monitoring.

Full observability/tracing can come later.

### Decision 84 — Media storage

**Decision:** S3-compatible object storage.

### Decision 85 — Transactional email

**Decision:** Dedicated transactional email provider.

### Decision 86 — Email provider

**Decision:**

- Development: **Mailtrap**
- Production: **Resend**

Laravel mail business logic should remain provider-agnostic.

### Decision 87 — Frontend component system

**Decision:** Tailwind CSS + shadcn/ui.

### Decision 88 — Offline behavior

**Decision:** Installable PWA, but all transactional actions require internet connectivity.

No offline booking/queue mutations.

### Decision 89 — WebSockets

**Decision:** Laravel Reverb.

### Decision 90 — Queue workers

**Decision:** Laravel queues + Redis + Horizon.

### Decision 91 — Testing baseline

**Decision:**

- Pest/PHPUnit
- Vitest + React Testing Library
- Focused Playwright E2E for critical journeys

### Decision 92 — CI/CD

**Decision:** GitHub Actions with automated test/build checks before deployment.

### Decision 93 — Environments

**Decision:**

- Development
- Staging
- Production

### Decision 94 — Release strategy

**Decision:** Automatic staging deployment after CI passes, manual production promotion.

---

## Data Retention and Privacy

### Decision 95 — Booking retention

**Decision:** Keep bookings permanently with their final status.

Examples:

- Completed
- Cancelled
- Rejected
- Expired
- No-show

### Decision 96 — Customer account deletion

**Decision:** Remove/anonymize personal profile data while retaining operational/legal/audit records that must remain.

### Decision 97 — Organization cancellation

**Decision:** Read-only recovery period, then eligible tenant operational data is deleted/anonymized.

### Decision 98 — Organization recovery period

**Decision:** Fixed **90 days**.

---

## Trial and Subscription Billing

### Decision 99 — Free trial

**Decision:** Free trial enabled.

Default: **14 days**, configurable at the Platform Admin level.

### Decision 100 — Trial expiry

**Decision:** Automatically enter restricted/read-only mode.

### Decision 101 — Trial-to-paid conversion

**Decision:** Generate PayMongo QR Ph payment request before the trial ends.

### Decision 102 — Billing cycle

**Decision:** Monthly only for MVP.

### Decision 103 — Renewal QR timing

**Decision:** Generate renewal payment request **7 days before subscription expiry**.

### Decision 104 — Renewal reminders

**Decision:** Email reminders:

- 7 days before expiry
- 3 days before expiry
- 1 day before expiry

### Decision 105 — Subscription grace period

**Decision:** Default **3 days**, configurable at the platform level.

### Decision 106 — Subscription price

**Decision:** One platform-wide monthly price, configurable globally by Platform Admin.

No custom per-tenant pricing in MVP.

### Decision 107 — Price changes

**Decision:** New global price applies to future renewals.

Current paid periods remain unchanged.

### Decision 108 — Expired QR request

**Decision:** Automatically generate a fresh QR Ph payment request when the previous request expires.

### Decision 109 — QR payment request expiry

**Decision:** **24 hours**.

### Decision 110 — Business activation readiness

**Decision:** Enforce a readiness checklist before accepting bookings.

Minimum:

- Business profile
- Operating hours
- At least one vehicle type
- At least one active service
- At least one compatible service/vehicle variant
- At least one active resource

### Decision 111 — Publishing

**Decision:** Owner manually clicks **Publish** after the readiness checklist passes.

---

## Booking Policy Details

### Decision 112 — Cancellation/reschedule cutoff

**Decision:** Default **2 hours before appointment**, configurable per organization.

### Decision 113 — After cutoff

**Decision:** Customer self-service cancel/reschedule is disabled.

Staff handles exceptions.

### Decision 114 — Rescheduling

**Decision:** Atomically secure the new slot first, then release the old slot.

Preserve previous schedule in history/audit.

### Decision 115 — Same-day booking

**Decision:** Allowed when the slot still satisfies the minimum booking notice.

### Decision 116 — Early arrival

**Decision:** Staff may check the customer in early, but their scheduled priority remains unchanged.

### Decision 117 — Late arrival after grace period

**Decision:** Release reserved capacity and place the customer into the next compatible queue position.

The booking remains valid.

### Decision 118 — Late-arrival representation

**Decision:** Keep normal booking lifecycle and record `late_arrival_at`.

Do not add a separate `LATE` booking status.

### Decision 119 — Early service completion

**Decision:** Automatically advance the next eligible checked-in customer/walk-in when safe.

Do not jeopardize upcoming confirmed appointment capacity.

---

## Add-ons and Resource Compatibility

### Decision 120 — Add-on pricing/duration

**Decision:** Add-on price and duration may vary by vehicle type.

### Decision 121 — Add-on compatibility

**Decision:** Explicit add-on ↔ primary-service compatibility rules.

### Decision 122 — Service availability windows

**Decision:** Services may be restricted to specific days/times independently of business hours.

### Decision 123 — Multiple compatible resource types

**Decision:** A service may use multiple compatible resource types.

Example: Motorcycle Wash may use `Motorcycle Bay` or `General Wash Bay`.

### Decision 124 — Resource preference

**Decision:** Configurable priority order per service.

Example:

1. Motorcycle Bay
2. General Wash Bay

### Decision 125 — Resource fallback

**Decision:** Automatically fall back to the next compatible resource type if the preferred type has no capacity.

### Decision 126 — Manual bay assignment validation

**Decision:** Staff may only choose a resource that is:

- Compatible
- Active
- Not blocked
- Currently available

Manual assignment must not bypass scheduling integrity.

### Decision 127 — Resource capacity

**Decision:** **Configurable capacity per physical resource.**

Reason: a small motorcycle wash may have one general wash bay that can physically serve multiple motorcycles simultaneously with 2–3 washers.

Example:

```text
General Wash Bay
capacity = 2 motorcycles
```

Worker count is not a scheduling resource in MVP. The bay/resource carries the bookable concurrent capacity.

---

## Advanced Capacity, Conflict Handling, and Operational Integrity

### Decision 128 — Capacity consumption model

**Decision:** Capacity consumption is configurable per **service + vehicle type + resource type**.

A booking does not always consume one generic slot. The configured unit cost reflects how much of a compatible resource the booking occupies.

### Decision 129 — Capacity consumption by resource type

**Decision:** The same service + vehicle combination may consume different capacity units depending on the resource type used.

### Decision 130 — Partial-capacity scheduling

**Decision:** Overlapping bookings are allowed while total consumed capacity stays within the physical resource's configured capacity.

### Decision 131 — Buffer capacity consumption

**Decision:** A booking continues consuming the same resource capacity during its configured post-service buffer.

### Decision 132 — Capacity unit representation

**Decision:** Capacity uses **positive whole-number units only**.

Use scaled integers when needed instead of decimal/floating-point capacity values.

### Decision 133 — Missing capacity-consumption configuration

**Decision:** A service + vehicle + resource type combination with no capacity-consumption configuration is unavailable.

Do not assume an implicit default such as `1` unit.

### Decision 134 — Resource type reservation after booking

**Decision:** A confirmed booking reserves capacity against the selected **resource type**.

The actual physical resource remains unassigned until service preparation/start. Reassignment remains possible when scheduling integrity is preserved.

### Decision 135 — Capacity across physical resources

**Decision:** Availability must be feasible against **individual physical resources**, not merely an aggregate resource-type pool.

A valid schedule must remain physically assignable.

### Decision 136 — Capacity splitting

**Decision:** One booking must fit entirely within one compatible physical resource.

Capacity cannot be split across multiple resources.

### Decision 137 — Automatic resource-type reassignment

**Decision:** If the selected resource type becomes unavailable, automatically attempt reassignment to another compatible resource type with sufficient capacity while preserving the original start time.

### Decision 138 — Reassignment cannot preserve booked time

**Decision:** If no compatible resource can preserve the confirmed appointment time, create a scheduling conflict and require staff intervention.

Never silently move the customer to another time.

### Decision 139 — Scheduling conflict representation

**Decision:** Scheduling conflict is a separate operational state, not a booking lifecycle status.

The booking retains its normal status while conflict metadata records the cause, timestamps, and resolution.

### Decision 140 — Conflict reschedule approval

**Decision:** If staff proposes a different appointment time to resolve a conflict, the customer must approve it before the confirmed schedule changes.

### Decision 141 — Conflict proposal response deadline

**Decision:** Reschedule proposals use a configurable customer response deadline.

The system may use a shorter response window when the appointment is close.

### Decision 142 — Expired reschedule proposal

**Decision:** When a conflict reschedule proposal expires, keep the original booking unchanged and return the conflict to staff resolution.

### Decision 143 — Active reschedule proposals

**Decision:** A booking may have only one active reschedule proposal at a time.

Sending a new proposal replaces/expires the previous proposal.

### Decision 144 — Proposed-slot capacity hold

**Decision:** The proposed new time temporarily reserves capacity while awaiting customer approval.

Release the hold when accepted, declined, expired, or replaced.

### Decision 145 — Original slot during pending reschedule

**Decision:** The original confirmed slot remains reserved while the proposed replacement slot is held.

This intentionally causes a temporary dual reservation to preserve the customer's confirmed appointment.

### Decision 146 — Customer declines conflict reschedule

**Decision:** Keep the original booking and return the scheduling conflict to staff resolution.

### Decision 147 — Customer accepts conflict reschedule

**Decision:** Atomically secure/confirm the new slot first, then release the original slot.

### Decision 148 — Conflict notifications

**Decision:** Notify staff immediately when a scheduling conflict occurs. Notify the customer only when staff sends a reschedule proposal.

### Decision 149 — Resource block overlapping future bookings

**Decision:** Allow staff to create the resource block, but immediately flag affected future bookings as scheduling conflicts.

### Decision 150 — Emergency resource shutdown

**Decision:** Automatically attempt compatible reassignment first. Flag any bookings that cannot be safely reassigned for staff resolution.

### Decision 151 — Temporary hold concurrency

**Decision:** Capacity checks and temporary holds must be atomic/transactional.

Concurrent customers cannot successfully reserve the same final capacity.

### Decision 152 — Manual capacity override

**Decision:** Configured resource capacity is a hard scheduling invariant.

Neither Owner nor Staff may intentionally overbook resource capacity.

### Decision 153 — Reducing resource capacity

**Decision:** Allow an Owner to reduce resource capacity even when future reservations are affected, but immediately flag newly infeasible bookings as scheduling conflicts.

### Decision 154 — Deactivating a service

**Decision:** Existing bookings remain valid. New bookings for the deactivated service are blocked.

### Decision 155 — Scheduling-critical configuration permissions

**Decision:** Only the **Owner** may change scheduling-critical configuration such as resource capacity, service duration, compatibility, and business hours.

### Decision 156 — Failed booking-related email

**Decision:** Email delivery failure does not invalidate the booking.

After retries are exhausted, expose the delivery failure to staff.

### Decision 157 — Transactional notification retries

**Decision:** Retry failed transactional emails through the queue with backoff, then mark them permanently failed when retry policy is exhausted.

### Decision 158 — OTP delivery failure

**Decision:** Show a clear delivery failure state and allow OTP resend after the configured cooldown.

### Decision 159 — Staff capacity visibility

**Decision:** Staff sees simple **used / total capacity** information for resources/time periods.

Do not expose unnecessary scheduler internals in normal operational UI.

### Decision 160 — Customer capacity visibility

**Decision:** Customers see available/unavailable appointment times only.

Do not expose internal remaining capacity counts.

### Decision 161 — Pending booking rejection

**Decision:** Staff rejection requires a reason and customer notification.

### Decision 162 — Pending approval response deadline

**Decision:** Pending approval bookings use a configurable staff response deadline.

If the deadline is missed, the booking expires according to the pending-booking policy.

### Decision 163 — Customer cancellation reason

**Decision:** Customer cancellation reason is optional.

### Decision 164 — Staff cancellation reason

**Decision:** Staff cancellation requires a reason and audit log.

### Decision 165 — Completed booking immutability

**Decision:** Core data of a completed booking becomes immutable.

Any legitimate correction must use audited administrative correction metadata/notes rather than rewriting historical booking facts silently.

### Decision 166 — Staff cancellation authority

**Decision:** Owner and Staff may cancel active customer bookings with a required reason and audit log.

### Decision 167 — Staff-created future bookings

**Decision:** Staff may create future appointments on behalf of customers.

Normal availability and capacity rules still apply.

### Decision 168 — Staff booking policy overrides

**Decision:** Owner and Staff may override policy rules such as minimum notice, booking window, or service availability windows when necessary, with a required reason.

Overrides may **never** bypass capacity or resource-integrity rules.

### Decision 169 — Customer email change

**Decision:** Verify the new email using OTP and notify the old email address of the change.

### Decision 170 — Organization ownership transfer

**Decision:** An Owner may transfer ownership to another verified staff member with explicit confirmation and audit logging.

### Decision 171 — Staff removal

**Decision:** Removing a staff member revokes access immediately and invalidates their active sessions.

### Decision 172 — Last Owner protection

**Decision:** The last Owner of an organization cannot be removed or demoted.

### Decision 173 — Staff invitation expiry

**Decision:** Staff invitations expire after a configurable period.

### Decision 174 — Business-hours changes affecting bookings

**Decision:** Allow the business-hours change, preserve existing bookings, and flag bookings that are now outside operating hours as scheduling conflicts.

### Decision 175 — Service-duration changes

**Decision:** Duration changes apply only to new bookings.

Existing bookings preserve the duration snapshot captured at booking time.

### Decision 176 — Price changes

**Decision:** Existing bookings preserve the price snapshot captured at booking time.

New pricing applies only to later bookings.

### Decision 177 — Vehicle-type deactivation

**Decision:** Existing bookings and saved vehicles remain valid historically, but the deactivated vehicle type cannot be used for new bookings.

### Decision 178 — Compatibility changes affecting future bookings

**Decision:** Existing booking snapshots remain authoritative.

Only flag a scheduling conflict when the changed compatibility makes the existing booking impossible to fulfill.

### Decision 179 — Resource deletion

**Decision:** Physical resources referenced by bookings/history are archived or deactivated, not permanently deleted.

### Decision 180 — Service deletion

**Decision:** Services with booking history are archived or deactivated, not permanently deleted.

### Decision 181 — Booking snapshot scope

**Decision:** Confirmed bookings snapshot all fulfillment-critical commercial and scheduling data.

Snapshot at least service identity/name, vehicle type, add-ons, price, duration, buffer, capacity consumption, selected resource type, and relevant policy values needed to preserve booking semantics.

### Decision 182 — Tenant audit-log visibility

**Decision:** Organization audit logs are visible to the Owner only.

Platform Admin retains platform-level access according to existing administration rules.

### Decision 183 — Permanently failed background jobs

**Decision:** Permanently failed operational/notification jobs appear in a staff operational failure view with an explicit retry capability.

### Decision 184 — Scheduling conflict dashboard

**Decision:** Provide a dedicated operational view for unresolved scheduling conflicts.

Show the affected booking, conflict cause, urgency, and available resolution actions.

### Decision 185 — Impact preview for destructive configuration changes

**Decision:** Before applying configuration changes that affect future bookings, show an impact preview.

Example: `3 future bookings will become conflicted.`

### Decision 186 — Booking lifecycle transitions

**Decision:** Enforce explicit allowed booking state transitions server-side.

Invalid lifecycle jumps must be rejected even if requested by the client.

### Decision 187 — Starting service without check-in

**Decision:** A scheduled booking must be checked in before staff can start service.

### Decision 188 — Service completion

**Decision:** Staff manually marks service completion.

Record the actual completion timestamp.

### Decision 189 — Capacity release on early completion

**Decision:** When service finishes early, release service capacity immediately while preserving any configured post-service buffer.

### Decision 190 — No-show capacity release

**Decision:** Once staff confirms a booking as no-show, release its remaining reserved capacity immediately.

### Decision 191 — Late actual service start

**Decision:** Record actual service start time and recalculate downstream ETA/delay predictions using actual operational timing.

### Decision 192 — Service overrun capacity

**Decision:** An overrunning service continues consuming capacity until actual completion.

### Decision 193 — Buffer after service overrun

**Decision:** Apply the configured post-service buffer even when the service has overrun its expected duration.

### Decision 194 — Ending buffer early

**Decision:** Staff may explicitly end a remaining post-service buffer early with a required reason and audit log.

### Decision 195 — Queue advancement when capacity frees early

**Decision:** Automatically surface the next eligible checked-in customer/walk-in for staff action when capacity becomes available earlier than expected.

Do not automatically start service without staff confirmation.

### Decision 196 — Walk-in capacity protection

**Decision:** No fixed capacity is reserved exclusively for walk-ins in MVP.

Walk-ins use genuinely available gaps. Confirmed appointments remain aggressively protected according to the existing scheduling rules. This resolves Decision 21.

### Decision 197 — Time storage

**Decision:** Store absolute timestamps in **UTC** and interpret/display them using the branch timezone.

The MVP branch timezone is `Asia/Manila`, but storage remains timezone-safe.

### Decision 198 — Duplicate booking submissions

**Decision:** Booking confirmation/creation must use idempotency protection so retries, double-clicks, or repeated network requests cannot create duplicate bookings.

Capacity validation remains necessary in addition to idempotency.

### Decision 199 — Existing bookings during subscription restriction

**Decision:** When a tenant enters restricted/read-only subscription state, existing bookings may still be operated through completion.

No new customer bookings may be accepted.

### Decision 200 — Customer actions during tenant restriction

**Decision:** Customers may cancel an existing booking created before restriction, but cannot reschedule it or create a new booking while the tenant remains restricted.

### Decision 201 — Staff authorization boundary

**Decision:** Staff is operational-only.

Staff may manage:

- Bookings
- Walk-ins
- Queue
- Check-in
- Service lifecycle
- Cancellations
- Conflicts
- Operational failures

Owner retains responsibility for:

- Configuration
- Pricing
- Resources
- Profile
- Staff
- Billing
- Audit

### Decision 202 — Identity for staff-created bookings and walk-ins

**Decision:** Walk-ins may use name only, with email optional.

Staff-created future appointments require a contact email.

A booking is not attached to a platform customer account until that email is customer-verified.

### Decision 203 — Platform customer app vs tenant branding

**Decision:** Use a neutral platform shell for directory, cross-shop bookings, vehicles, and profile.

Use tenant branding on shop pages and tenant-specific booking flows.

### Decision 204 — Subscription period anchoring

**Decision:** Early renewal extends from the existing `paid_until`.

If expired, the paid period starts from confirmed payment.

Payment during a trial starts the paid month when the trial ends.

### Decision 205 — Cancellation vs non-renewal

**Decision:** Non-renewal follows:

`expiry → grace → restricted state`

Non-renewal does not automatically start deletion.

#### The 90-day recovery/deletion timer starts only when the Owner explicitly requests organization closure.

### Decision 206 — Owner and Staff navigation model

**Decision:** Use one shared tenant application shell with role-aware navigation.

#### Desktop

Owner and Staff use the same dark sidebar navigation pattern.

Navigation items are shown according to the authenticated user's authorization.

Staff sees only operational destinations they are permitted to access.

Owner may access operational destinations plus Owner-only areas such as Settings.

#### Mobile

Use native-style bottom navigation as the primary tenant application navigation.

Staff retains the previously approved mobile navigation:

- Dashboard
- Queue
- Bookings
- Walk-in
- More

Owner uses the same primary mobile navigation model rather than introducing a separate hamburger-based application shell.

Owner-only destinations, including **Settings**, are accessed through **More**.

Additional secondary destinations such as conflicts, booking requests, account actions, and future Owner-only areas may also be exposed through More when appropriate.

#### Settings navigation

Settings uses secondary navigation inside the Settings area.

Current Settings destinations are:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

On desktop, Settings navigation is presented horizontally according to the approved Owner configuration design.

On mobile, Settings navigation must remain compact, touch-friendly, horizontally scrollable or otherwise appropriately composed without replacing the application-level bottom navigation.

#### Navigation hierarchy

The hierarchy is:

`Tenant application navigation → Settings → Settings section navigation`

Application-level navigation and Settings section navigation are separate concerns.

#### Constraints

- Do not use a hamburger or collapsible sidebar as the primary tenant mobile navigation.
- Do not create a separate Owner-only mobile navigation paradigm.
- Do not replace the mobile bottom navigation when entering Settings.
- Navigation must remain responsive, accessible, keyboard-operable where applicable, and suitable for an installable PWA.
- Authorization remains server-controlled. Hiding a navigation item is not an authorization mechanism.

### Decision 207 — Owner Settings section navigation

**Decision:** Use horizontal text navigation with a primary-colored active underline for Owner Settings sections.

Current Settings destinations are:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

#### Desktop

Settings navigation is displayed horizontally near the top of the Settings content area.

The active section uses:

- Primary-colored text
- A visible primary-colored underline

Inactive sections use neutral text.

Do not render every Settings destination as a bordered pill or filled button.

The `OWNER ONLY` indicator, publication state, readiness indicators, and other contextual status must remain visually separate from the navigation itself.

A Settings item that needs attention may show a warning icon or badge in addition to its label.

#### Mobile

Settings navigation remains secondary navigation inside the Settings area.

It must:

- Stay horizontally oriented where practical
- Be horizontally scrollable when all items do not fit
- Preserve a clear active underline
- Use touch-friendly targets
- Avoid wrapping into an uncontrolled multi-row tab layout
- Remain visually subordinate to the application-level bottom navigation

Entering Settings must not replace or remove the tenant application bottom navigation defined in Decision 206.

#### Accessibility

Each Settings destination is a normal navigation link because each section is a separate page.

Requirements:

- Use a navigation landmark with an accessible label such as `Settings`
- Use `aria-current="page"` on the active destination
- Preserve visible keyboard focus
- Do not rely on color alone for readiness or warning states

#### Constraints

- Do not use solid-filled active pills as the canonical Settings navigation.
- Do not introduce a secondary Settings sidebar for MVP.
- Do not allow implementation code to redefine this navigation pattern without an approved decision and corresponding reference UI update.

### Decision 208 — Desktop tenant navigation structure

**Decision:** Keep one consolidated operational workspace instead of splitting day-to-day operations into multiple desktop pages.

#### Desktop navigation

The primary tenant desktop sidebar uses these destinations:

- Operations
- Booking Requests
- Conflicts
- Settings

`Operations` is the primary day-to-day workspace.

It contains or provides access to:

- Today / operational summary
- Queue
- Scheduled bookings
- Walk-ins
- Check-in
- Service lifecycle actions
- Physical resource assignment
- Resource blocks
- Operational failures
- Retry or recovery actions related to operations

These capabilities do not require separate desktop routes solely to reproduce an earlier reference UI navigation structure.

#### Mobile navigation

Mobile navigation continues to follow Decisions 46, 47, and 206.

Primary Staff mobile destinations remain:

- Dashboard
- Queue
- Bookings
- Walk-in
- More

These mobile destinations may represent focused views, filters, or entry points into the consolidated operational domain.

They do not require the desktop application to expose an identical one-route-per-tab navigation structure.

Owner uses the same tenant mobile navigation model with role-aware access as defined in Decision 206.

#### Booking Requests

Booking Requests remains a separate destination because pending approval requests require a distinct decision workflow.

It may be available to Owner and Staff according to authorization policy.

#### Conflicts

Scheduling Conflicts remains a separate destination because unresolved scheduling conflicts require a dedicated resolution workflow.

#### Settings

Settings remains an Owner-only primary destination and contains the secondary Settings navigation defined in Decision 207.

#### Reference UI interpretation

Approved reference UI remains authoritative for:

- Visual hierarchy
- Navigation styling
- Spacing
- Status communication
- Interaction patterns
- Responsive quality

The exact route or page boundaries shown in an older reference UI are not authoritative when a later locked decision explicitly defines a different information architecture.

Decision 208 supersedes the earlier reference UI only for the exact desktop sidebar destination structure.

#### Constraints

- Do not create separate desktop Dashboard, Queue, Bookings, Walk-in, or Operational Failures pages only to match an older mockup.
- Do not duplicate the same operational workflow across multiple desktop navigation destinations without a clear product reason.
- Do not remove Booking Requests, Conflicts, or Settings from the primary desktop navigation.
- Navigation visibility must remain role-aware.
- Server-side authorization remains authoritative regardless of navigation visibility.

### Decision 209 — Owner Settings page heading model

**Decision:** Each Owner Settings section owns its own visible page heading and supporting description.

The shared Owner shell must not use one generic Settings heading such as `Scheduling configuration` for every Settings page.

#### Settings page titles

Use section-specific page titles:

- `Settings · Profile`
- `Settings · Hours`
- `Settings · Services`
- `Settings · Resources`
- `Settings · Booking Policy`
- `Settings · Readiness`
- `Settings · Directory`

Each Settings page may include one concise supporting description explaining the purpose of that section.

#### Shared shell responsibilities

The shared Owner shell owns:

- Application-level navigation
- Organization identity
- Branch context
- Publication or readiness status
- Settings secondary navigation
- Shared status, entitlement, or access messaging

The shared shell does not own the page-specific `h1`.

#### Page responsibilities

Each Settings page owns:

- Its `h1`
- Supporting description
- Page-specific actions
- Page-specific status or summary information
- Domain content and forms

The page heading should appear before the primary page content and establish the current editing context clearly.

#### Desktop

Desktop pages should provide a clear hierarchy:

`Application shell → Settings navigation → Page heading → Page content`

The page heading may share its row with page-specific actions when appropriate.

#### Mobile

The section-specific page heading must remain visible and concise on mobile.

Avoid duplicating generic headings that consume vertical space without adding context.

The mobile hierarchy remains:

`Application navigation → Settings navigation → Current Settings page → Content`

#### Accessibility

- Each Settings page must expose one meaningful primary `h1`.
- The `h1` must identify the current Settings section.
- Do not rely only on the active Settings navigation state to communicate the current page.
- Heading levels below the page title must follow a logical hierarchy.

#### Constraints

- Do not hardcode `Scheduling configuration` as the `h1` for every Settings page.
- Do not render both a generic `Settings` `h1` and a second section-level heading solely for visual hierarchy.
- Do not move page-specific titles into the shared shell unless a future approved decision explicitly changes the ownership model.
- Changes to the shared Owner shell must not override page-specific heading semantics.

### Decision 210 — Owner Billing navigation and lifecycle placement

**Decision:** Billing is an Owner-only primary application destination, separate from the Owner Settings section navigation.

#### Desktop navigation

The Owner desktop primary navigation includes:

- Operations
- Booking Requests
- Conflicts
- Billing
- Settings

Billing is treated as a primary Owner destination because it governs subscription entitlement, renewal, recovery, and organization lifecycle actions.

Decision 210 amends Decision 208 only by adding `Billing` to the Owner desktop primary navigation.

#### Staff navigation

Staff does not have access to Billing.

Billing visibility is Owner-only and must follow server-side authorization.

#### Mobile navigation

Billing does not receive its own permanent bottom-navigation item.

Owner accesses Billing through:

`More → Billing`

The primary mobile bottom navigation continues to follow Decisions 46, 47, and 206.

#### Relationship to Settings

Billing is not part of the Settings secondary navigation.

The Settings secondary navigation remains:

- Profile
- Hours
- Services
- Resources
- Booking Policy
- Readiness
- Directory

Billing must not be added as an eighth Settings tab.

#### Billing responsibilities

Billing may contain:

- Current subscription or trial status
- Paid-through or entitlement information
- Renewal actions
- Payment request status
- Grace or restricted-state information
- Subscription recovery actions
- Organization closure
- Organization recovery during the allowed recovery period

Organization closure must remain clearly separated from ordinary renewal actions because closure starts the independent organization recovery and deletion lifecycle.

#### Restricted and closed states

Billing must remain accessible to an authorized Owner when the organization is:

- In grace
- Restricted
- Pending recovery after explicit closure

This access is required so the Owner can renew, recover, or manage the organization lifecycle.

Normal configuration restrictions must not accidentally block Billing recovery workflows.

#### Routing and implementation

Billing is conceptually an application-level Owner destination even if an existing route or frontend file currently lives under a `settings` namespace.

Route paths and source-code folder structure do not determine the product navigation hierarchy.

A future refactor may move Billing to a clearer application-level route or page location without changing the behavior defined by this decision.

#### Accessibility and security

- Billing navigation must expose a clear accessible label.
- The active Billing destination must use `aria-current="page"`.
- Hiding Billing from Staff navigation is not an authorization mechanism.
- Server-side authorization remains authoritative.
- Subscription and organization lifecycle mutations must continue to enforce authorization and existing billing invariants.

#### Constraints

- Do not add Billing to the Settings tab navigation.
- Do not expose Billing to Staff.
- Do not hide Billing behind Settings on desktop.
- Do not assign Billing a permanent mobile bottom-navigation slot for MVP.
- Do not make Billing unreachable because the organization is restricted or explicitly closed.
- Do not combine subscription non-renewal with organization closure or deletion.

### Decision 211 — Authority precedence for product, UI, and implementation

**Decision:** Rinquo uses an explicit authority hierarchy so implementation cannot redefine approved product or design decisions.

#### Authority order

When two sources disagree, use the following precedence:

1. Locked Decisions
2. Approved Reference UI
3. Design System
    - Design tokens
    - UI registry
    - Documented reusable patterns
4. Reusable UI and domain components
5. Page implementation
6. Tests

Higher-authority sources override lower-authority sources.

#### Locked Decisions

Locked Decisions are the highest product and design authority.

They define approved behavior, scope, navigation, architecture boundaries, product rules, and explicitly locked UI decisions.

A later locked decision may explicitly supersede:

- An earlier locked decision
- An older reference UI
- A design-system pattern
- Existing implementation behavior

When a decision supersedes an older source, the affected documentation and implementation must be updated to reflect the newer decision.

#### Approved Reference UI

Approved Reference UI is the visual implementation baseline when no higher locked decision explicitly says otherwise.

Reference UI may define:

- Visual hierarchy
- Layout composition
- Navigation presentation
- Spacing
- Responsive composition
- Interaction patterns
- Status presentation
- Component relationships

Existing implementation must not override an approved reference simply because the implementation already differs from it.

A reference design is authoritative only for the patterns, states, pages, and viewports it actually represents.

Do not infer unsupported behavior from a reference image when the design does not show that behavior.

#### Design System

The design system must conform to:

1. Locked Decisions
2. Approved Reference UI

The design system includes:

- `resources/css/app.css`
- `resources/js/components/ui/`
- `docs/design-system/ui-registry.yaml`
- Documented reusable UI patterns

The design system standardizes approved patterns. It does not have authority to silently change an approved product or visual decision.

Do not update the UI registry merely to describe implementation drift.

When implementation conflicts with an approved decision or reference, fix the implementation or explicitly resolve the conflict before updating the registry.

#### Reusable components

Reusable components implement the design system.

Existing reusable components are not product authority.

If a component conflicts with a higher-authority source, the component must be corrected, replaced, or intentionally deprecated.

Do not preserve an incorrect component solely because multiple pages already depend on it.

#### Page implementation

Page implementation must follow all applicable higher-authority sources.

Existing page code represents current implemented behavior, not approval of that behavior.

Implementation must not become canonical solely because it was shipped first.

#### Tests

Tests verify the approved contract.

Tests do not define product or design authority.

A passing test does not legitimize behavior that conflicts with a higher-authority source.

When an approved contract changes:

1. Update the authoritative documentation first.
2. Update the design system when affected.
3. Update implementation.
4. Update tests to verify the approved result.

Do not change authoritative documentation solely to make an existing test pass.

#### Unspecified UI behavior

If a page, viewport, state, or interaction is not covered by a Locked Decision or approved Reference UI:

1. Reuse an existing approved design-system pattern when one clearly applies.
2. Preserve established accessibility and responsive requirements.
3. Do not contradict an existing Locked Decision.
4. Treat the resulting implementation as an implementation choice, not automatically as a new locked design decision.

A material new pattern that is expected to become canonical must be reviewed and approved before being promoted into the design system.

#### Same-level conflicts

If two sources at the same authority level materially conflict:

- Do not choose the version that happens to match current code.
- Do not silently merge incompatible interpretations.
- Stop and resolve the conflict explicitly.
- Record the resulting decision when it affects product behavior, architecture, navigation, or a canonical UI pattern.

#### Repository source-of-truth distinction

The repository remains the source of truth for what is currently implemented.

The repository's implementation is not automatically the source of truth for what is approved.

These are separate questions:

- **What should Rinquo do?** Follow the authority hierarchy defined by this decision.
- **What does Rinquo currently do?** Inspect the current repository implementation.

Differences between the two are implementation gaps and must be treated as such.

#### Constraints

- Do not modify Locked Decisions to legitimize implementation drift.
- Do not modify approved Reference UI solely to match existing code.
- Do not update the design-system registry solely to describe an unapproved implementation.
- Do not treat component reuse as evidence that a pattern is approved.
- Do not treat passing tests as evidence that a conflicting implementation is correct.
- Do not promote an inferred or page-local pattern into the canonical design system without approval.

### Decision 212 — Reference UI approval and locking
**Decision:** Canonical Reference UI must use an explicit approval manifest. A design file is not authoritative merely because it exists under `docs/reference-ui/`.

#### Reference UI states

Every Reference UI entry must have one of these statuses:

- `Draft`
- `Approved`
- `Superseded`

Only `Approved` references participate in the authority hierarchy defined by Decision 211.

A `Draft` reference may be used for review and iteration but must not be treated as an implementation contract.

A `Superseded` reference remains available for historical context but must not be used as the current implementation baseline.

#### Reference manifest

`docs/reference-ui/README.md` acts as the Reference UI manifest.

Every canonical reference must record:

- Reference file
- Product surface or route
- Viewport or responsive target
- Approval status
- Applicable Locked Decisions
- What the reference locks
- Approval date
- Supersedes, when applicable
- Superseded by, when applicable
- Relevant implementation or design-system notes when necessary

Example:

```text
Reference: 06-owner-settings-profile-desktop.png
Surface: Owner Settings / Profile
Route: /settings/profile
Viewport: Desktop
Status: Approved
Decisions: 206, 207, 209, 211, 212
Locks: page hierarchy, application shell, settings navigation,
       content composition, spacing, action placement
Approved: 2026-10-06
Supersedes: none
Superseded by: none
```

#### File presence does not equal approval

A PNG, image, prototype, mockup, screenshot, or other design artifact committed under `docs/reference-ui/` is not automatically authoritative.

The artifact becomes authoritative only when its manifest entry is explicitly marked:

`Status: Approved`

This prevents:

- Experimental designs from becoming canonical
- Implementation screenshots from becoming design authority
- Unreviewed AI-generated designs from becoming locked references
- Old designs from remaining active after replacement

#### Approval scope

A Reference UI is authoritative only for what it visibly and explicitly represents.

A reference may lock areas such as:

- Page hierarchy
- Navigation placement
- Layout composition
- Component relationships
- Visual hierarchy
- Spacing
- Status presentation
- Action placement
- Responsive composition
- Empty, loading, error, disabled, or other represented states

Do not infer behavior that is not represented by the reference or defined by a Locked Decision.

#### Responsive approval

Desktop and mobile are separate visual contracts.

When a product surface materially changes between desktop and mobile, both variants must be approved before the responsive pattern is considered fully locked.

For significant Owner, Staff, Customer, and booking surfaces, the expected reference pair is:

```text
<reference-name>-desktop.png
<reference-name>-mobile.png
```

An approved desktop reference does not automatically define the mobile composition.

An approved mobile reference does not automatically define the desktop composition.

When only one viewport is approved, uncovered viewports must follow existing Locked Decisions and approved design-system patterns without claiming that the inferred composition is itself locked.

#### Material responsive surfaces

For material application surfaces, approval should normally cover at least:

- Desktop
- Mobile

Tablet behavior may be derived responsively from the approved desktop and mobile contracts unless a materially different tablet composition requires its own reference.

#### Superseding a reference

When an approved design is intentionally replaced:

1. Create the replacement reference.
2. Review it against applicable Locked Decisions.
3. Mark the replacement `Approved`.
4. Mark the old reference `Superseded`.
5. Record the relationship in both manifest entries.
6. Update affected design-system documentation.
7. Update implementation.
8. Update applicable tests.

Do not delete the old reference merely to hide historical divergence.

#### Relationship to Locked Decisions

Reference UI must conform to Locked Decisions.

When a later Locked Decision intentionally changes something represented in an approved reference:

- The Locked Decision takes precedence.
- The affected reference must be considered partially stale until replaced or updated.
- The manifest must record the conflict or supersession.
- Implementation must follow the newer Locked Decision.

Do not continue treating a visibly conflicting reference as fully current.

#### Relationship to the Design System

An approved Reference UI may introduce or demonstrate a reusable pattern.

That pattern becomes canonical across the product only after the affected design-system documentation or registry is updated.

The workflow is:

`Locked Decision → Approved Reference UI → Design System → Implementation → Tests`

Do not reverse this workflow by implementing a pattern first and then changing the reference or registry solely to match the implementation.

#### Review requirements

Before marking a Reference UI `Approved`, verify:

- It does not conflict with applicable Locked Decisions.
- Desktop and mobile behavior are accounted for where required.
- Navigation follows the approved information architecture.
- Accessibility requirements are representable by the proposed design.
- Existing design tokens and canonical components are reused where appropriate.
- New reusable patterns are clearly identified.
- Critical loading, empty, error, disabled, restricted, destructive, or recovery states are considered when relevant.

#### Generated designs

AI-generated or automatically produced design references are considered `Draft` by default.

Generation alone does not constitute approval.

They must go through the same review and manifest approval process as manually created designs.

#### Constraints

- Do not treat file presence as approval.
- Do not treat an implementation screenshot as an approved design without explicit review.
- Do not mark a design `Approved` solely because implementation already matches it.
- Do not infer mobile layout from desktop and call it locked.
- Do not silently overwrite or replace an approved reference.
- Do not leave superseded references marked `Approved`.
- Do not promote a new reusable visual pattern into the design system before its authoritative basis is established.

# Current Core Architecture Summary

```text
Platform
├── Platform Admin
│
├── Customer Accounts
│   ├── Shared Profile
│   ├── Saved Vehicles
│   └── Cross-shop Booking History
│
└── Organizations
    └── Branch (1 active branch in MVP)
        ├── Owner / Staff
        ├── Business Hours
        ├── Services
        │   ├── Vehicle Variants
        │   ├── Add-ons
        │   ├── Availability Windows
        │   └── Compatible Resource Types
        ├── Physical Resources
        │   ├── Type
        │   ├── Integer Capacity Units
        │   ├── Per Service/Vehicle/Resource Consumption
        │   └── Blocks / Maintenance
        ├── Bookings
        │   ├── Immutable Fulfillment Snapshots
        │   ├── Capacity Reservations / Holds
        │   ├── Scheduling Conflicts
        │   └── Reschedule Proposals
        ├── Queue
        ├── Operational Failures
        └── Notifications
```

## Current Booking Flow

```text
Customer opens business
        ↓
Select vehicle
        ↓
Select primary service + add-ons
        ↓
Select date + available exact start time
        ↓
Enter/verify details by email OTP
        ↓
Availability revalidated atomically
        ↓
Auto-confirm OR Pending Approval
        ↓
Capacity reserved
        ↓
Pre-arrival reminder
        ↓
Staff check-in
        ↓
Queue / delay handling
        ↓
Staff assigns compatible physical bay
        ↓
Service starts
        ↓
Service completes
        ↓
Customer receives ready/completed notification
```

## Current MVP Technology Direction

```text
Backend         Laravel modular monolith
Frontend        Inertia + React + TypeScript
UI              Tailwind CSS + shadcn/ui
Database        PostgreSQL
Cache/Queue     Redis
Queue Monitor   Laravel Horizon
Realtime        Laravel Reverb
PWA             Mobile-first installable web app
Email Dev       Mailtrap
Email Prod      Resend
Billing         PayMongo QR Ph
Media           S3-compatible object storage
CI/CD           GitHub Actions
Deployment      Dockerized VPS
DB Hosting      Managed PostgreSQL with PITR
Redis           Managed Redis
Monitoring      Structured logs + error tracking + uptime monitoring
Testing         Pest/PHPUnit + Vitest/RTL + focused Playwright
```

# Important Planning Notes

1. **Decision 21 is resolved by Decision 196:** no fixed walk-in capacity reserve in MVP. Walk-ins use genuine gaps while confirmed appointments remain protected.
2. Exact appointment start time is the target, but operational overruns may cause delays. If predicted delay exceeds 5 minutes, customers are notified.
3. Workers are **not individually scheduled in MVP**. Physical resource capacity is the scheduling constraint.
4. Resource capacity uses positive integer units. Consumption is configured per service + vehicle type + resource type, and schedules must remain feasible against individual physical resources.
5. Confirmed bookings preserve fulfillment-critical snapshots so later configuration changes do not silently rewrite booking semantics.
6. Capacity/resource integrity is a hard invariant. Staff policy overrides cannot create overcapacity schedules.
7. Scheduling conflicts are operational state, not booking lifecycle status, and unresolved conflicts have a dedicated staff workflow.
8. Do not introduce microservices, native mobile apps, multi-country support, full marketplace mechanics, or complex worker scheduling into MVP unless a later approved decision explicitly changes scope.
9. Decision discovery is effectively complete. Ask additional decision questions only when a genuinely material unresolved issue would change scope, UX, architecture, security, cost, or implementation.

# Continue Planning

The next chat should continue **after Decision 200**. Do not reopen resolved decisions unless a contradiction is discovered.

Proceed with the remaining `/plan` workflow:

1. Verify that no material unresolved decisions remain.
2. Generate the applicable concise planning documents.
3. Generate 2–5 representative reference UI screens based on the approved decisions and ask `Need changes or approve?`.
4. After UI approval, generate the vertical implementation roadmap and specs.
5. Run the planning quality gate for scope, architecture, security, data integrity, workflows, failure cases, testability, operations, and documentation consistency.
6. Package the approved planning documents and reference screens into the final downloadable ZIP.

If additional material decisions are discovered, ask up to **5 decision questions per round**, mark one option as `Recommended`, and never repeat already resolved decisions.
