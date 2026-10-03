# ADR 0002: Shared-Schema Multi-Tenancy

- Status: Accepted

## Context

The SaaS serves independent organizations while sharing infrastructure.

## Decision

Use one PostgreSQL database/schema. Tenant-owned records carry `organization_id`. Authorization and query scoping enforce tenant isolation.

## Consequences

Simple operations and reporting, but tenant isolation becomes a critical application invariant requiring focused automated tests.
