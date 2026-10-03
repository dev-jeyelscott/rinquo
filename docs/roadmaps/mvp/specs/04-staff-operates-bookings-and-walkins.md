# 04. Staff Operates Bookings and Walk-ins

## Working outcome

Staff can run the daily operation from arrival through completion while protecting confirmed appointments and physical resource capacity.

## Users

Staff, Owner

## Applicable implementation areas

- Operations dashboard and queue using the approved reference UI.
- Staff-only check-in, including early check-in without changing scheduled priority.
- Walk-in creation using earliest compatible safe gap.
- Staff-created future bookings with audited policy override when necessary.
- Manual physical-resource assignment with compatibility, active, block, and availability validation.
- Service start only after check-in.
- Actual start/completion timestamps and ETA recalculation.
- Overrun and post-service buffer behavior.
- Manual queue reorder with required reason and audit.
- Operational notification/job failure visibility and retry.

## Acceptance criteria

- Walk-ins use genuine gaps only and do not jeopardize confirmed appointments.
- Policy overrides can never bypass hard resource capacity.
- Actual resource assignment cannot select blocked, inactive, incompatible, or unavailable resources.
- Overrunning service consumes capacity until completion and buffer still applies afterward.
- Early completion releases service capacity while preserving buffer unless explicitly ended with audited reason.
- No-show capacity releases only after staff confirmation.
- Unverified staff-created walk-ins do not automatically become platform accounts.

## Verification requirements

- Queue and manual reorder tests.
- Check-in/start/completion transition tests.
- Walk-in earliest-safe-gap tests.
- Physical-resource assignment validation tests.
- Overrun/buffer/early-completion/no-show capacity tests.
- Operational failure retry tests.

## Material risks

- Queue logic that ignores future appointments can cause avoidable delays.
- Manual assignment is a likely capacity-integrity bypass if not server-validated.
- ETA updates must not rewrite the confirmed appointment time.

## Implementation Context Prompt

Inspect the approved staff operations and scheduling decisions plus the staff dashboard reference screen. Implement the complete daily-operation flow for scheduled bookings and walk-ins. Keep Staff operational-only. Enforce check-in before start, validate actual resource assignment server-side, protect future confirmed capacity, record actual timing, model overruns and buffers correctly, and require audited reasons for manual overrides. Include operational failure states and retry capability. Strictly and explicitly follow the required rules and deliverables.
