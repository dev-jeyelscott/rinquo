# High-Level User Journeys

## 1. Owner activates a business

Sign up with email OTP → create organization → configure profile/hours → configure vehicle types/services/resource capacity → pass readiness checklist → Publish.

## 2. Customer books

Open shop → choose vehicle → choose primary service/add-ons → choose date and exact available start → enter/verify email → atomic capacity revalidation → auto-confirm or pending approval → confirmation email.

## 3. Staff handles a walk-in

Create walk-in customer/vehicle → find earliest compatible safe gap → create queue entry → check in → assign compatible physical resource → start service → complete service.

## 4. Staff operates a scheduled booking

Customer arrives → staff checks in → queue/ETA updates → staff assigns valid physical resource → start service → downstream ETA recalculates → complete service → customer notified.

## 5. Scheduling conflict resolution

Configuration/resource change creates conflict → automatic same-time compatible reassignment attempted → unresolved conflict appears in dashboard → staff proposes replacement slot with temporary hold → customer accepts/declines/expires → booking updated atomically only on acceptance.

## 6. Customer account across shops

Verify once → use shared profile/vehicles → browse directory or direct shop links → view cross-shop bookings in neutral platform shell → enter tenant-branded booking experience for a selected shop.

## 7. SaaS renewal

Renewal QR generated 7 days before expiry → PayMongo confirms payment by webhook → paid-through date extends from existing entitlement → grace/restriction only if unpaid → existing bookings remain operable in restricted state.

## 8. Organization closure

Owner explicitly requests closure → 90-day recovery period → eligible tenant operational data becomes deletable/anonymizable after recovery period. Mere non-renewal does not start this deletion timer.
