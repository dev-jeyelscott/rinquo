# Project Charter

## Goal

Build a production-ready SaaS platform that lets Philippine car and motorcycle wash/detailing businesses publish availability, accept online bookings, manage walk-ins and queue operations, and protect physical resource capacity.

## Primary users

- Customer
- Organization Owner
- Staff
- Platform Admin

## MVP outcomes

- Customer discovers a business or opens its direct booking page.
- Customer books an exact planned start time without a deposit.
- Staff handles bookings, walk-ins, queue, check-in, service start/completion, conflicts, and operational failures.
- Owner configures business profile, services, prices, hours, resources, scheduling rules, staff, billing, and audit visibility.
- Platform Admin manages platform billing/configuration and audited support access.
- Tenant data remains isolated in a shared-schema PostgreSQL architecture.

## Constraints

- Philippines-only MVP
- Responsive PWA only
- One active branch per organization
- Resource capacity, not workers, is the scheduling constraint
- No customer service payment handling
- Email-only transactional notifications
- One flat SaaS subscription plan
- No microservices or speculative marketplace features

## Success criteria

The MVP is successful when a tenant can configure and publish its business, customers can make valid bookings without overbooking, staff can complete day-to-day operations, subscription restriction behaves safely, and core workflows are testable and recoverable.
