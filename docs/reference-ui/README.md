# Reference UI Manifest

This directory contains Rinquo's reviewed visual reference designs.

Reference UI participates in the authority hierarchy defined by Decision 211:

`Locked Decisions → Approved Reference UI → Design System → Reusable Components → Page Implementation → Tests`

Reference approval and lifecycle follow Decision 212.

A design artifact is authoritative only when its manifest entry is explicitly marked `Approved`.

File presence alone does not constitute approval.

## Status definitions

### Draft

The reference is being designed or reviewed.

A Draft reference:

- may be used for discussion and iteration,
- must not be treated as an implementation contract,
- must not be used to redefine the design system.

### Approved

The reference is an approved visual contract for the surface, viewport, state, and patterns it explicitly represents.

Approved references remain subordinate to Locked Decisions.

### Superseded

The reference has been intentionally replaced.

It remains in the repository for historical context but must not be used as the current implementation baseline.

## Approved reference manifest

Paths are relative to `docs/reference-ui/`.

| Reference                                           | Surface                                              | Viewport          | Status                              | Approved   |
| --------------------------------------------------- | ---------------------------------------------------- | ----------------- | ----------------------------------- | ---------- |
| `01-customer-shop-home.png`                         | Tenant-branded customer shop home                    | Mobile            | Approved                            | 2026-10-04 |
| `02-booking-schedule.png`                           | Tenant booking schedule selection                    | Mobile            | Superseded (mobile Schedule visual) | 2026-10-04 |
| `03-staff-operations-dashboard.png`                 | Staff operational workspace                          | Desktop           | Superseded by Spec 04               | 2026-10-04 |
| `04-scheduling-conflict-resolution.png`             | Scheduling conflict resolution                       | Desktop           | Superseded by Spec 05               | 2026-10-04 |
| `05-owner-scheduling-configuration.png`             | Owner scheduling configuration                       | Desktop           | Superseded for Owner Settings       | 2026-10-04 |
| `spec-02/desktop/01-vehicle.png`                    | Vehicle selection                                    | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/02-service.png`                    | Service + add-ons                                    | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/03-schedule.png`                   | Schedule selection                                   | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/04-details.png`                    | Customer details                                     | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/05-email-verification.png`         | Email OTP verification                               | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/06-confirm.png`                    | Review and confirm                                   | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/07-booking-confirmed.png`          | Booking confirmed outcome                            | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/desktop/08-request-sent.png`               | Pending-approval outcome                             | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `spec-02/mobile/01-vehicle.png`                     | Vehicle selection                                    | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/02-service.png`                     | Service + add-ons                                    | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/03-schedule.png`                    | Schedule selection                                   | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/04-details.png`                     | Customer details                                     | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/05-email-verification.png`          | Email OTP verification                               | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/06-confirm.png`                     | Review and confirm                                   | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/07-booking-confirmed.png`           | Booking confirmed outcome                            | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-02/mobile/08-request-sent.png`                | Pending-approval outcome                             | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/desktop/owner-shell-desktop.png`    | Owner shell and Settings index (`/settings`)         | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/profile-desktop.png`        | Settings Profile (`/settings/profile`)               | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/hours-desktop.png`          | Settings Hours (`/settings/hours`)                   | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/services-desktop.png`       | Settings Services (`/settings/services`)             | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/resources-desktop.png`      | Settings Resources (`/settings/resources`)           | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/booking-policy-desktop.png` | Settings Booking Policy (`/settings/booking-policy`) | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/readiness-desktop.png`      | Settings Readiness (`/settings/readiness`)           | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/desktop/directory-desktop.png`      | Settings Directory (`/settings/directory`)           | Desktop 1600×1000 | Approved                            | 2026-10-08 |
| `owner-settings/mobile/owner-shell-mobile.png`      | Owner shell and Settings index (`/settings`)         | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/profile-mobile.png`          | Settings Profile (`/settings/profile`)               | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/hours-mobile.png`            | Settings Hours (`/settings/hours`)                   | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/services-mobile.png`         | Settings Services (`/settings/services`)             | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/resources-mobile.png`        | Settings Resources (`/settings/resources`)           | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/booking-policy-mobile.png`   | Settings Booking Policy (`/settings/booking-policy`) | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/readiness-mobile.png`        | Settings Readiness (`/settings/readiness`)           | Mobile 390×844    | Approved                            | 2026-10-08 |
| `owner-settings/mobile/directory-mobile.png`        | Settings Directory (`/settings/directory`)           | Mobile 390×844    | Approved                            | 2026-10-08 |
| `spec-03/desktop/01-confirmed-management.png`       | Confirmed booking and management                     | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/01-confirmed-management.png`        | Confirmed booking and management                     | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/02-pending-approval.png`           | Pending approval and management                      | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/02-pending-approval.png`            | Pending approval and management                      | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/03-in-service-status.png`          | Operational progress                                 | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/03-in-service-status.png`           | Operational progress                                 | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/04-cancel-reason.png`              | Cancellation entry and optional reason               | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/04-cancel-reason.png`               | Cancellation entry and optional reason               | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/05-cancel-confirmation.png`        | Final cancellation review                            | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/05-cancel-confirmation.png`         | Final cancellation review                            | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/06-cancelled-result.png`           | Cancellation completed                               | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/06-cancelled-result.png`            | Cancellation completed                               | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/07-reschedule-select.png`          | Choose replacement date and exact start              | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/07-reschedule-select.png`           | Choose replacement date and exact start              | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/08-reschedule-review.png`          | Review replacement before applying                   | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/08-reschedule-review.png`           | Review replacement before applying                   | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/09-reschedule-success.png`         | Successful replacement appointment                   | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/09-reschedule-success.png`          | Successful replacement appointment                   | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/10-cutoff-reached.png`             | After self-service cutoff                            | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/10-cutoff-reached.png`              | After self-service cutoff                            | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/11-tenant-restricted.png`          | Shop temporarily restricted                          | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/11-tenant-restricted.png`           | Shop temporarily restricted                          | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/12-staff-proposed-time.png`        | Staff-proposed replacement time                      | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/12-staff-proposed-time.png`         | Staff-proposed replacement time                      | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/13-proposal-accept-review.png`     | Accept proposed time confirmation                    | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/13-proposal-accept-review.png`      | Accept proposed time confirmation                    | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-03/desktop/14-completed-history.png`          | Completed booking and history                        | Desktop 1600×1000 | Approved                            | 2026-10-09 |
| `spec-03/mobile/14-completed-history.png`           | Completed booking and history                        | Mobile 390×844    | Approved                            | 2026-10-09 |
| `spec-04/desktop/01-overview.png`                   | Operations overview                                  | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/01-overview.png`                    | Operations overview                                  | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/02-queue.png`                      | Queue and focused action ordering                    | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/02-queue.png`                       | Queue and focused action ordering                    | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/03-booking-details.png`            | Booking context and available actions                | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/03-booking-details.png`             | Booking context and available actions                | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/04-check-in.png`                   | Customer arrival and check-in                        | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/04-check-in.png`                    | Customer arrival and check-in                        | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/05-resource-assignment.png`        | Assign compatible physical resource                  | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/05-resource-assignment.png`         | Assign compatible physical resource                  | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/06-start-service.png`              | Start service after check-in                         | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/06-start-service.png`               | Start service after check-in                         | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/07-complete-service.png`           | Complete with protected buffer                       | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/07-complete-service.png`            | Complete with protected buffer                       | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/08-create-walk-in.png`             | Create walk-in in earliest safe gap                  | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/08-create-walk-in.png`              | Create walk-in in earliest safe gap                  | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/09-create-booking.png`             | Create staff scheduled booking                       | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/09-create-booking.png`              | Create staff scheduled booking                       | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/10-reorder-queue.png`              | Audited manual queue reorder                         | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/10-reorder-queue.png`               | Audited manual queue reorder                         | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/11-no-show.png`                    | Grace-aware no-show confirmation                     | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/11-no-show.png`                     | Grace-aware no-show confirmation                     | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/12-block-resource.png`             | Block bay and review affected scheduling             | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/12-block-resource.png`              | Block bay and review affected scheduling             | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/13-release-block.png`              | Release resource block                               | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/13-release-block.png`               | Release resource block                               | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/14-delays-capacity.png`            | Overruns, predictions and capacity                   | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/14-delays-capacity.png`             | Overruns, predictions and capacity                   | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/15-notification-recovery.png`      | Notification failure and retry                       | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/15-notification-recovery.png`       | Notification failure and retry                       | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/16-realtime-offline-recovery.png`  | Reconnect, stale, offline and recovery               | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/16-realtime-offline-recovery.png`   | Reconnect, stale, offline and recovery               | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-04/desktop/17-owner-role-navigation.png`      | Role-aware shell and mobile navigation               | Desktop 1600×1000 | Approved                            | 2026-10-11 |
| `spec-04/mobile/17-owner-role-navigation.png`       | Role-aware shell and mobile navigation               | Mobile 390×844    | Approved                            | 2026-10-11 |
| `spec-05/desktop/01-overview.png` | Scheduling conflicts workspace | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/01-overview.png` | Scheduling conflicts workspace | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/02-queue.png` | Conflict queue | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/02-queue.png` | Conflict queue | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/03-booking-details.png` | Affected booking details | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/03-booking-details.png` | Affected booking details | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/04-same-time-reassigned.png` | Same-time reassignment | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/04-same-time-reassigned.png` | Same-time reassignment | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/05-replacement-selection.png` | Replacement-time selection | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/05-replacement-selection.png` | Replacement-time selection | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/06-proposal-confirmation.png` | Send proposal confirmation | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/06-proposal-confirmation.png` | Send proposal confirmation | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/07-awaiting-response.png` | Awaiting customer reply | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/07-awaiting-response.png` | Awaiting customer reply | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/08-replace-proposal.png` | Replace active proposal | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/08-replace-proposal.png` | Replace active proposal | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/09-withdraw-proposal.png` | Withdraw active proposal | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/09-withdraw-proposal.png` | Withdraw active proposal | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/10-customer-accepted.png` | Customer acceptance outcome | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/10-customer-accepted.png` | Customer acceptance outcome | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/11-customer-declined.png` | Customer decline recovery | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/11-customer-declined.png` | Customer decline recovery | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/12-proposal-expired.png` | Proposal expiry recovery | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/12-proposal-expired.png` | Proposal expiry recovery | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/13-resolution-history.png` | Recently resolved conflicts | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/13-resolution-history.png` | Recently resolved conflicts | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/14-impact-preview.png` | Resource/configuration impact preview | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/14-impact-preview.png` | Resource/configuration impact preview | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/15-stale-offline.png` | Stale and offline recovery | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/15-stale-offline.png` | Stale and offline recovery | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-05/desktop/16-no-replacement.png` | No eligible replacement | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-05/mobile/16-no-replacement.png` | No eligible replacement | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/01-account-home.png` | Neutral customer Home | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/01-account-home.png` | Neutral customer Home | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/02-email-sign-in.png` | Customer email sign-in | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/02-email-sign-in.png` | Customer email sign-in | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/03-email-otp.png` | Customer sign-in code | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/03-email-otp.png` | Customer sign-in code | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/04-shop-directory.png` | Searchable business directory | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/04-shop-directory.png` | Searchable business directory | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/05-directory-empty.png` | Directory no matching results | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/05-directory-empty.png` | Directory no matching results | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/06-tenant-handoff.png` | Selected shop context (context only) | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/06-tenant-handoff.png` | Selected shop context (context only) | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/07-cross-shop-bookings.png` | Cross-shop booking overview | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/07-cross-shop-bookings.png` | Cross-shop booking overview | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/08-bookings-empty.png` | Verified online bookings empty | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/08-bookings-empty.png` | Verified online bookings empty | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/09-saved-vehicles.png` | Shared saved vehicles | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/09-saved-vehicles.png` | Shared saved vehicles | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/10-add-vehicle.png` | Add customer vehicle | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/10-add-vehicle.png` | Add customer vehicle | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/11-archive-confirmation.png` | Archive vehicle confirmation | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/11-archive-confirmation.png` | Archive vehicle confirmation | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/12-customer-profile.png` | Neutral customer profile | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/12-customer-profile.png` | Neutral customer profile | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/13-edit-profile.png` | Edit shared profile | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/13-edit-profile.png` | Edit shared profile | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/14-email-change-request.png` | Request verified email change | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/14-email-change-request.png` | Request verified email change | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/15-email-change-otp.png` | Verify new email address | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/15-email-change-otp.png` | Verify new email address | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/16-email-change-success.png` | Email change completed | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/16-email-change-success.png` | Email change completed | Mobile 390×844 | Approved | 2026-10-12 |
| `spec-06/desktop/17-email-change-recovery.png` | Email verification failure recovery | Desktop 1600×1000 | Approved | 2026-10-12 |
| `spec-06/mobile/17-email-change-recovery.png` | Email verification failure recovery | Mobile 390×844 | Approved | 2026-10-12 |

The sixteen Spec 02 booking references were reviewed and approved together on 2026-10-08 under Decision 212; they are canonical under `spec-02/`.

The original references (01-05) were introduced together with the approved MVP planning baseline. The sixteen Owner Settings references were reviewed and approved on 2026-10-08 under Decision 212.

The PNG files for `01`-`05` were removed from the working tree when the Owner Settings references were introduced. They remain retrievable from Git history (the last commit containing them) and the entries below are kept as history. Their locks are not re-verifiable from the working tree until the images are restored, and `05` is superseded for Owner Settings regardless.

## 01 — Customer shop home

**Reference:** `01-customer-shop-home.png`

**Surface:** Tenant-branded public shop experience

**Viewport:** Mobile

**Status:** Approved

**Locks:**

- Tenant-branded customer presentation
- Shop identity hierarchy
- Primary booking call to action
- Today's-hours presentation
- Location summary
- Popular-service presentation
- Native-feeling mobile composition
- Customer bottom-navigation visual direction where represented

**Does not lock:**

- Desktop composition
- Tablet composition
- States not represented in the image
- Backend behavior
- Exact implementation component boundaries

The desktop customer shop layout must not be inferred from this image and described as locked.

## 02 — Booking schedule

**Reference:** `02-booking-schedule.png`

**Surface:** Customer booking flow, schedule selection

**Viewport:** Mobile

**Status:** Superseded

**Superseded by:** `spec-02/mobile/03-schedule.png` (approved 2026-10-08).

The replacement is authoritative for the mobile customer Schedule visual contract. The original remains as history only. The previous image's `40 min capacity` copy was not approved because Locked Decisions prohibit exposing internal scheduling capacity to customers. Backend scheduling semantics remain unchanged.

**Historical locks (no longer the implementation baseline):**

- Booking progress hierarchy
- Selected-service summary
- Date selection presentation
- Exact-start-time selection presentation
- Available vs unavailable slot hierarchy
- Current selection summary
- Mobile primary-action placement
- Native-feeling mobile booking composition

**Does not lock:**

- Desktop booking composition
- Tablet composition
- Scheduling algorithms
- Capacity calculations not explicitly visualized
- States not represented by the reference

Scheduling behavior remains governed by Locked Decisions and scheduling ADRs.

## 03 — Staff operations dashboard

**Reference:** `03-staff-operations-dashboard.png`

**Surface:** Staff operational workspace

**Viewport:** Desktop

**Status:** Superseded

**Superseded by:** `spec-04/desktop/01-overview.png` (approved 2026-10-11) for the full-page Operations composition. The dark sidebar, blue primary action, queue-first hierarchy, status text, capacity and attention visual language below carry forward into Spec 04.

**Historical locks (no longer the implementation baseline):**

- Dark desktop tenant sidebar visual language
- Operational workspace visual hierarchy
- Operational status presentation
- Desktop density and content organization
- Navigation styling where not superseded by later Locked Decisions

**Later authority:**

Decisions 206 and 208 define the current application navigation model.

Where the exact navigation destinations in this reference differ from those decisions, the Locked Decisions take precedence.

**Does not lock:**

- Mobile navigation
- Mobile operations composition
- Exact route boundaries for Dashboard, Queue, Bookings, Walk-in, or Operational failures

Mobile tenant navigation is governed by Decisions 46, 47, and 206.

## 04 — Scheduling conflict resolution

**Reference:** `04-scheduling-conflict-resolution.png`

**Surface:** Staff scheduling conflict resolution

**Viewport:** Desktop

**Status:** Superseded by Spec 05

**Superseded by:** the approved Spec 05 desktop conflict workspace references (2026-10-12).

**Locks:**

- Conflict severity and warning hierarchy
- Affected-booking presentation
- Resolution-option composition
- Selected-resolution visual treatment
- Desktop conflict-resolution layout
- Operational visual language shared with Staff surfaces

**Does not lock:**

- Mobile conflict-resolution composition
- Conflict-domain state transitions
- Authorization rules
- Exact scheduling conflict algorithms

Domain behavior remains governed by Locked Decisions and scheduling implementation contracts.

## 05 — Owner scheduling configuration

**Reference:** `05-owner-scheduling-configuration.png`

**Surface:** Owner scheduling configuration

**Viewport:** Desktop

**Status:** Superseded for Owner Settings

**Superseded by:** the sixteen Owner Settings references below (approved 2026-10-08).

All Owner Settings shell, application-navigation, Settings-navigation, page-heading, branch/publication-context, and page-composition authority now comes from the sixteen approved Owner Settings references. Reference `05` must not be used as the Owner Settings baseline.

It is retained as history for the old Owner scheduling-configuration surface. It remains the only reference for the Owner configuration impact/review visual direction (the scheduling-impact review step), which the new references do not represent. Decisions 206-210 and the Owner Settings references govern all shared tokens and shell treatment.

This reference predates Decisions 206-210. Their navigation, Settings navigation, Billing placement, and page-heading rules were never overridden by it.

## Owner Settings references (approved 2026-10-08)

All sixteen entries below are `Approved` under Decision 212 on 2026-10-08, with the shared lock boundary and applicable decisions defined here. They replace the Owner Settings portions of reference `05`.

**Files** (relative to `docs/reference-ui/`, canonical paths, not to be renamed or re-exported without a new manifest entry):

- `owner-settings/desktop/{owner-shell,profile,hours,services,resources,booking-policy,readiness,directory}-desktop.png` (1600×1000)
- `owner-settings/mobile/{owner-shell,profile,hours,services,resources,booking-policy,readiness,directory}-mobile.png` (390×844)

**Applicable Locked Decisions:** 44, 46, 47, 201, 206, 207, 208, 209, 210, 211, 212. Page-specific domain Locked Decisions still govern each page's subject matter and are locked here only where the image visibly represents it.

**Owner shell and Settings index, desktop (`owner-shell-desktop.png`)**

Locks:

- Dark Owner application sidebar treatment: wordmark, business and branch identity, Published status chip, the five destinations Operations, Booking Requests, Conflicts, Billing, Settings, filled active destination, account email and Sign out
- Owner destination hierarchy and the Settings active state
- Branch and publication context (branch chip and Published chip) shown as context in the page header, not as Settings navigation
- Settings index composition: `Settings` page heading with description, two-column grid of the seven destination cards (title, description, chevron)
- Desktop Settings navigation: seven route-based text links with a primary-colored active underline, above the page content

**Owner shell and Settings index, mobile (`owner-shell-mobile.png`)**

Locks:

- Mobile header: wordmark, business and branch name, Published chip
- Settings index composition: `Settings` page heading with description, then a vertical list of the seven destinations, each with an initial-letter tile, label, short description, and chevron; Readiness shows its `Ready` status in addition to its label
- Bottom navigation (Dashboard, Queue, Bookings, Walk-in, More) stays visible with `More` active
- No horizontally scrollable secondary navigation is shown or locked on mobile; mobile Settings navigation is the index plus the section back link

**Settings pages, desktop** (`profile`, `hours`, `services`, `resources`, `booking-policy`, `readiness`, `directory` `-desktop.png`)

Lock, per page: the `Settings · <Section>` page heading with description; the SETTINGS eyebrow; the underline Settings navigation with the section active; the branch/publication context; the section-specific card, form, table, status, and action composition; the page spacing and hierarchy.

**Settings pages, mobile** (`profile`, `hours`, `services`, `resources`, `booking-policy`, `readiness`, `directory` `-mobile.png`)

Lock, per page: the `‹ Settings` back link above the heading; the literal short section heading shown (`Profile`, `Hours`, `Services`, `Resources`, `Booking Policy`, `Readiness`, `Directory`) with its description; the single-column card composition; the bottom navigation with `More` active; the mobile branch/publication header.

**Approved interpretations of Locked Decisions (2026-10-08)**

1. *Mobile Settings navigation (Decisions 206 and 207).* Decision 207 asks for horizontal Settings navigation on mobile where practical, and Decision 206 allows an otherwise appropriately composed mobile layout. The approved mobile composition is the Settings index plus a `‹ Settings` back link on each section page. This is the approved reading of "otherwise appropriately composed". A horizontally scrollable underline navigation on mobile is not approved by these references. The Decision 207 mobile amendment in `docs/decision.md` records the same composition.
2. *Mobile page headings (Decision 209).* The mobile references show the literal short section heading (for example `Services`) under the back link instead of `Settings · <Section>`. This literal heading is locked for the mobile reference. Decision 209 remains a Locked Decision and higher authority. The Decision 209 mobile amendment in `docs/decision.md` permits the visible mobile `h1` to omit the `Settings ·` prefix while `Settings · <Section>` remains the required accessible page title and the desktop heading. Any other reading of the mobile heading must be resolved against Decision 209, not this manifest.

**Does not lock (non-authoritative rendering artifacts)**

The images contain rendering defects that are not approved design. Implementations must not reproduce them:

- the `+ Add vehicle` and `+ Add service` buttons overlapping row content in Services desktop
- placeholder or tofu glyph boxes in Resources desktop, Readiness desktop, Resources mobile, Readiness mobile, and the placeholder circle icons in the mobile bottom navigation (icon glyphs are not locked)
- the `Same-day booking...` helper text overflowing its card in Booking Policy desktop
- text overlap and clipping in mobile Profile (cropped at the bottom edge), Hours (overrides card cropped), Booking Policy (description overlapping field labels), and Directory (description overlapping the state rows)
- the cropped or truncated content at the bottom edge of any mobile image

**Also does not lock**

- States not shown: loading, empty, error, validation, disabled, saving, and success states
- Tablet composition and any viewport other than 1600×1000 desktop and 390×844 mobile
- Placeholder sample data, copy beyond headings and structure, and exact pixel dimensions
- Domain behavior, authorization, tenant isolation, readiness derivation, scheduling feasibility, and billing lifecycle, which remain governed by Locked Decisions and ADRs
- Navigation visibility as authorization

Billing remains a primary Owner application destination outside Settings navigation (Decision 210).

## Spec 02. Customer creates a valid booking (approved 2026-10-08)

**Approval:** User approved all 16 core references together on 2026-10-08.

**Files:** `spec-02/desktop/01-vehicle.png` through `08-request-sent.png` (1600×1000), and the corresponding eight `spec-02/mobile/` PNGs (390×844).

**Product surfaces:** `/shops/{slug}/book`, `/shops/{slug}/book/holds/{hold}/details`, `/shops/{slug}/book/holds/{hold}/confirm`, and `/shops/{slug}/bookings/{booking}` in the represented states; the verified-email screen is a Details substate, not a sixth wizard stage.

**Applicable Locked Decisions:** 3, 14, 15, 16, 17, 22–26, 28, 44, 49–52, 57–61, 203, 211, 212, plus governing scheduling/tenancy decisions.

**Status:** Approved (2026-10-08).

**Locks:** Five-stage booking progress (Vehicle, Service, Schedule, Details, Confirm); tenant-branded shell, responsive hierarchy and mobile primary-action placement; vehicle type and make/model composition; compatible service/add-on selection and visible price/duration deltas; calendar/date and exact-start-time chips with unavailable states, Next available and selected time; temporary hold and countdown; guest contact details, six-digit email OTP, resend cooldown; final review with edit affordances and busy/uncertainty recovery; distinct `Booking confirmed` and `Request sent` status presentations.

**Supersession:** `spec-02/mobile/03-schedule.png` supersedes `02-booking-schedule.png` for the _mobile Schedule visual contract_. No other prior reference is superseded by this batch.

**Supporting Approved UX patterns:** `spec-02/states/desktop-critical-states.png`, `spec-02/states/mobile-critical-states.png` illustrate loading, unavailable/empty/offline, OTP/hold failure, lost-slot and uncertain-confirmation recovery, busy, pending and expiry states. These are not additional canonical routed pages.

**Review-only artifacts:** `spec-02/review/` comparisons and `spec-02/review-contact-sheet.png` illustrate the approval package; they are not independent canonical page contracts.

**Does not lock:** Example shop names, prices, vehicles, dates, booking IDs, customer data; backend API or database structure; internal resource IDs, capacity, buffers or resource matching; scheduling/OTP provider algorithms; implementation assumptions not visible in the references; tablet breakpoints beyond existing responsive rules; unrelated Spec 01/03, Owner, Staff, Billing and Platform Admin surfaces.

**Implementation gaps after approval:** The currently inspected booking wizard lacks explicit vehicle make/model collection despite Locked Decision 23; `BookingSummaryCard` exposes buffer time despite the approved customer-facing duration model. Reconcile these through the normal domain and design-system implementation steps without changing capacity-safe scheduling, holds, OTP or idempotency.

For the per-image route/state, viewport, lock and exclusion record, see `spec-02/manifest.md`.

## Spec 03. Customer manages an existing booking (approved 2026-10-09)

**Approval:** User approved all 28 core references (14 desktop 1600×1000, 14 mobile 390×844) together on 2026-10-09 under Decision 212; they are canonical under `spec-03/`.

**Files:** `spec-03/desktop/01-confirmed-management.png` through `14-completed-history.png` and the corresponding fourteen `spec-03/mobile/` PNGs.

**Product surface:** `/shops/{slug}/bookings/{booking}` in the represented states (confirmed, pending, in service, cancel entry, cancel review, cancelled, reschedule select/review/success, cutoff, restricted, staff-proposed time, proposal review, completed). It is one shared route; management is the scroll/focus state below the result.

**Applicable Locked Decisions:** 9, 10, 14, 70, 112, 113, 140–147, 186, 200, 203, 211, 212.

**Status:** Approved (2026-10-09).

**Spec 02 is not superseded:** the approved `Booking confirmed` and `Request sent` outcomes and the tenant header stay authoritative at the top of the shared route. Spec 03 management sits below them.

**Supporting Approved UX patterns:** `spec-03/critical-states/` boards (live connection, refresh failure, stale revision, offline, cutoff and restriction, unavailable replacement, proposal expiry, invalid terminal transitions, checked-in, delayed, in-service, completed progress) are state patterns, not routes. `spec-03/comparisons/` and `spec-03/review/` are review-only artifacts.

**Does not lock:** sample shop names, prices, times, booking IDs and customer data; raster fallback fonts; backend or database structure; resource, capacity or buffer detail; customer self-check-in or deposits.

For the per-image route/state, locks, exclusions and implementation notes, see `spec-03/manifest.md`.

## Spec 04. Staff operates bookings and walk-ins (approved 2026-10-11)

**Approval:** User approved all 34 core references (17 desktop 1600×1000, 17 mobile 390×844) together on 2026-10-11 under Decision 212; they are canonical under `spec-04/`.

**Files:** `spec-04/desktop/01-overview.png` through `17-owner-role-navigation.png` and the corresponding seventeen `spec-04/mobile/` PNGs.

**Product surface:** the Operations workspace and its operational actions (check-in, assignment, start, completion, walk-in, staff booking, reorder, no-show, resource blocks, failure retry), realtime/offline recovery states, and the role-aware shared Owner/Staff shell. Desktop remains one consolidated Operations workspace; mobile may use focused Dashboard, Queue, Bookings, Walk-in and More views or anchors over the same domain without adding desktop top-level routes. `03-booking-details` is a contextual sheet, not a dedicated route.

**Applicable Locked Decisions:** 4, 7, 8, 9, 12, 13, 20, 21, 33–35, 46, 47, 69, 88, 186–196, 201, 206, 208, 210, 211, 212.

**Status:** Approved (2026-10-11).

**Supersession:** `spec-04/desktop/01-overview.png` supersedes `03-staff-operations-dashboard.png` for the full-page Operations composition. The approved Owner shell references (`owner-settings/desktop/owner-shell-desktop.png`, `owner-settings/mobile/owner-shell-mobile.png`) are **not** superseded; pair 17 applies role-aware composition while preserving them. Specs 02 and 03 remain Approved and unchanged.

**Behavioral boundaries:** Staff never sees Owner-only Billing or Settings destinations, and server-side authorization remains the enforcement point. The no-show screens depict grace-aware confirmation; Decisions 8 and 20 govern the server rule. The realtime/offline screens are target UI only; no transactional action is offered offline.

**Does not lock:** sample names, dates, prices, service catalog, counters and ETA values; backend API or database structure; any new scheduling algorithm, employee assignment, customer self-check-in or speculative status; optional review presentation for check-in and start beyond the smallest needed confirmation change.

**Not in the repository package:** the `review/` boards, comparisons, contact sheet and audit notes listed in `spec-04/manifest.md` were not committed with the package and are not canonical.

For the per-image route/state, locks, exclusions and implementation notes, see `spec-04/manifest.md`.

## Spec 05. Staff resolves scheduling conflicts (approved 2026-10-12)

**Approval:** User approved all 32 core references (16 desktop 1600×1000 and 16 mobile 390×844) together on 2026-10-12 (Asia/Manila) under Decision 212.

**Files:** `spec-05/desktop/01-overview.png` through `16-no-replacement.png`, and matching `spec-05/mobile/` PNGs. The precise inventory and visual contracts are recorded in `spec-05/manifest.md`.

**Product surface:** Owner/Staff scheduling conflict queue and resolution workspace, same-time reassignment history, customer proposals, replacement, withdrawal, declined/expired recovery, customer-accepted resolution, resource/configuration impact preview, and stale/offline/no-candidate states. Customer responses remain in the Spec 03 customer-management journey.

**Applicable Locked Decisions:** 137–151, 175–181, 184–185, 201, 206–212.

**Status:** Approved (2026-10-12).

**Supersession:** `04-scheduling-conflict-resolution.png` is superseded by the Spec 05 desktop conflicts family. All earlier approved Specs and Owner Settings retain their own status and scope.

**Behavioral boundaries:** No new scheduling algorithm, state enum, endpoint, unbounded candidate search, independent mobile conflicts tab, or staff access to Owner-only settings. Booking snapshots, protected original reservation, customer approval, proposal hold, tenant isolation and atomic capacity are mandatory.

**Rendering artifacts:** The “Draft reference” badge, specimen index labels, sample customer data and presentation footers inside screenshots are nonproduction metadata, not visual requirements.

## Spec 06. Customer uses Rinquo across shops (approved 2026-10-12)

**Approval:** User approved all 34 core references (17 desktop 1600×1000 and 17 mobile 390×844) together on 2026-10-12 (Asia/Manila) under Decision 212, and confirmed that approval for registration on 2026-10-12; they are canonical under `spec-06/`.

**Files:** `spec-06/desktop/01-account-home.png` through `17-email-change-recovery.png`, and the matching seventeen `spec-06/mobile/` PNGs. The per-image route/state, applicable decisions, visual contract and implementation boundary are recorded in `spec-06/manifest.md`.

**Product surface:** the neutral Rinquo customer account under `/account/...`: email sign-in and code, Home and Book (two navigation intents over the one `/account/directory` route), directory search, results and valid zero results, cross-shop verified online bookings and their empty state, shared saved vehicles (add and archive confirmation), the shared profile, profile edit, and the verified email change request, code, success and recovery states.

**Applicable Locked Decisions:** 3, 24, 28, 44, 45, 71–80, 169, 203, 211, 212, and ADRs 0002 and 0004.

**Status:** Approved (2026-10-12).

**Locks:** neutral Rinquo branding on every account surface; the desktop header with five text destinations (Home, Book, Bookings, Vehicles, Profile), one current destination, verified-account context and the account avatar; the mobile header plus five icon-only bottom destinations with accessible names and one current destination (Decision 45); the two-panel sign-in and six-digit code composition; directory search by business name and city/municipality, with cards showing logo (or initials), name, city, services, starting price, business hours, View shop and Book; the explicit zero-results state with Clear search; booking rows with shop origin, local date and time, status text and a View booking deep link, plus the cross-business privacy note; saved vehicle rows with archive and the focused archive confirmation that says existing bookings do not change; the profile summary, explicit-save edit, email change request, code entry, success and failure-recovery compositions.

**Context only:** `06-tenant-handoff.png` illustrates the move from the neutral account into an existing tenant-branded `/shops/{slug}` page. It does not redesign or supersede the approved tenant storefront, `01-customer-shop-home.png`, or the Spec 02 and Spec 03 journeys.

**Supersession:** none. Specs 02–05, Owner Settings and every earlier reference keep their status and scope.

**Behavioral boundaries:** no password or social sign-in, no dashboard endpoint for Home, no vehicle editing, no new booking or status lifecycle, no customer self check-in and no linking of activity through an unverified staff-entered email. Directory listing requires Owner opt-in, publication, readiness and acceptance of new bookings (Decisions 74–78). The current account email stays active until the new address is verified, and the old address is notified after the change (Decision 169).

**Does not lock (rendering artifacts and sample data):** the `SPEC 06 · DRAFT REFERENCE · Illustrative data` footer, specimen data (shop, customer, vehicle and booking names, prices, hours, dates), the illustrated car photographs and booking thumbnails, the `Recovery gap to resolve` note in reference 17, raster fonts and exact pixel sizes, and any interaction, loading, offline or retry mechanism the images do not show. Supporting material under `spec-06/review-support/` (boards, comparisons, contact sheet, supplementary states and the repository audit) is review-only and not canonical.

## Responsive coverage

Desktop and mobile references are separate visual contracts when their compositions materially differ.

Current approved coverage is incomplete:

| Surface                                                                                                                       | Mobile                         | Desktop                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------- |
| Customer shop home                                                                                                            | Approved                       | Not yet locked                   |
| Booking schedule (historical `02`)                                                                                            | Superseded by Spec 02          | Not yet locked                   |
| Customer booking journey (Spec 02: vehicle, service, schedule, details, email verification, confirm, confirmed, request sent) | Approved (2026-10-08, 390×844) | Approved (2026-10-08, 1600×1000) |
| Customer booking management (Spec 03: management, cancel, reschedule, proposal, progress, history) | Approved (2026-10-09, 390×844) | Approved (2026-10-09, 1600×1000) |
| Staff operations (Spec 04: overview, queue, actions, walk-in, blocks, recovery, role-aware shell) | Approved (2026-10-11, 390×844) | Approved (2026-10-11, 1600×1000) |
| Conflict resolution (Spec 05)                                                                                                  | Approved (2026-10-12, 390×844) | Approved (2026-10-12, 1600×1000) |
| Customer account across shops (Spec 06: sign-in, Home/Book directory, bookings, vehicles, profile, email change) | Approved (2026-10-12, 390×844) | Approved (2026-10-12, 1600×1000) |
| Owner shell and Settings                                                                                                      | Approved (2026-10-08)          | Approved (2026-10-08)            |

Owner Settings coverage is limited to the shell, the Settings index, and the seven pages at the viewports listed above. Owner Operations follows the shared Spec 04 references (including role-aware pair 17). Other Owner surfaces outside Settings (Booking Requests, Billing) have no approved Owner-specific reference. Conflicts follows the shared Owner/Staff Spec 05 references.

An uncovered viewport must follow:

1. Applicable Locked Decisions
2. Existing approved design-system patterns
3. Accessibility requirements
4. Responsive implementation guidance

An inferred composition does not become locked merely because it has been implemented.

## Approval workflow

A new visual reference follows this sequence:

`Draft → Review → Approved → Design System → Implementation → Tests`

Before changing a reference to `Approved`:

1. Verify applicable Locked Decisions.
2. Verify navigation and information architecture.
3. Verify desktop/mobile coverage where materially different.
4. Verify accessibility feasibility.
5. Verify use of existing approved tokens and patterns.
6. Identify any new canonical design-system patterns.
7. Record what the reference actually locks.
8. Record any superseded reference.

## Supersession workflow

When replacing an Approved reference:

1. Add the replacement reference.
2. Review it against applicable Locked Decisions.
3. Mark the replacement `Approved`.
4. Mark the old reference `Superseded` if it is fully replaced.
5. If only part is replaced, document the specific superseded areas.
6. Update the design system.
7. Update implementation.
8. Update tests.

Do not silently overwrite approved reference files.

## Interpretation rule

Reference UI is a visual contract, not implementation proof.

A reference tells us what an approved surface should look and behave like within the scope it represents.

To determine what currently exists in Rinquo, inspect the repository implementation.

A difference between the two is an implementation gap.
