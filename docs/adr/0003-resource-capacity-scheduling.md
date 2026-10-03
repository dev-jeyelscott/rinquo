# ADR 0003: Physical Resource Capacity Scheduling

- Status: Accepted

## Context

A service may consume different integer capacity units depending on vehicle and resource type. One physical resource may serve multiple compatible bookings concurrently.

## Decision

Availability must remain feasible against individual physical resources. A booking reserves a compatible resource type but must always be physically assignable to one resource. Holds and confirmation are atomic.

## Consequences

The scheduler is more complex than simple slot counting, but avoids physically impossible bookings. Capacity is never split across physical resources.
