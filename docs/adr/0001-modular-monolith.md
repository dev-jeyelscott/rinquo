# ADR 0001: Laravel Modular Monolith

- Status: Accepted

## Context

The MVP has multiple business domains but does not require independent deployment or scaling boundaries.

## Decision

Use one Laravel modular monolith with Inertia/React. Use PostgreSQL, Redis, Horizon, Reverb, and framework-native boundaries.

## Consequences

Lower deployment and operational complexity. Domain modules must remain explicit enough to prevent a tightly coupled codebase.
