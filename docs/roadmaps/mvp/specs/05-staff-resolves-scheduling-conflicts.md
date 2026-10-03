# 05. Staff Resolves Scheduling Conflicts

## Working outcome

The system detects configuration/resource disruptions, preserves confirmed booking semantics, and gives Staff a controlled workflow to resolve conflicts without silent schedule changes.

## Users

Staff, Owner, Customer

## Applicable implementation areas

- Automatic same-time reassignment to another compatible resource type when safe.
- Explicit scheduling-conflict records separate from booking lifecycle status.
- Dedicated conflict dashboard and booking-resolution flow.
- Impact preview before configuration changes that affect future bookings.
- One active customer reschedule proposal with response deadline.
- Temporary proposed-slot hold while original slot stays reserved.
- Atomic accept, decline, expiry, and replacement behavior.
- Immediate staff notification; customer notification only when proposal is sent.

## Acceptance criteria

- Resource block/capacity/hour/compatibility changes preserve existing snapshots.
- Same-time safe reassignment does not alter customer appointment time.
- If no safe same-time resource exists, an explicit conflict is created.
- Proposed time never becomes confirmed before customer acceptance.
- Original and proposed slots may be dual-held without violating capacity.
- Expired/declined proposals release only the proposal hold and return conflict to staff.
- Only one active proposal exists per booking.

## Verification requirements

- Conflict generation tests for resource blocks, capacity reductions, hours changes, and compatibility changes.
- Same-time reassignment tests.
- Proposal hold concurrency tests.
- Accept/decline/expire/replace transaction tests.
- UI tests against the approved conflict screen.

## Material risks

- Silent rescheduling violates the approved customer contract.
- Dual holds increase temporary capacity pressure and must remain transactional.
- Impact analysis must use booking snapshots, not only current configuration.

## Implementation Context Prompt

Inspect the approved scheduling-conflict decisions and reference screen before implementation. Build conflict detection and resolution as an operational layer separate from booking lifecycle status. Attempt same-time compatible reassignment first. Otherwise preserve the original booking, create explicit conflict metadata, and require customer approval for time changes. Proposed slots must be transactionally held while the original remains reserved. Cover resource block, capacity, hours, compatibility, expiry, decline, acceptance, replacement, and concurrency paths. Strictly and explicitly follow the required rules and deliverables.
