# Production cutover checklist (restored cluster)

Requires an **incident commander** and a **second authorized approver**. Record
both names and the time of approval in the incident ticket before step 4.

1. [ ] Declare the incident; freeze deploys; announce the maintenance window.
2. [ ] Restored cluster created as a NEW cluster; `restore-drill.sh` validation passed against it.
3. [ ] Row counts and the newest records are consistent with the recovery point; data loss window recorded.
4. [ ] Incident commander: ______ and second approver: ______ approve cutover (time, UTC: ______).
5. [ ] Put the application in maintenance mode, or stop `web`, `horizon`, `scheduler` and `reverb`.
6. [ ] Update `DB_HOST`/credentials in `/opt/rinquo/app.env` (never commit); keep the provider CA mounted for `verify-full`.
7. [ ] Redeploy the current release with `deploy.sh <image@digest>`; confirm migrations are a no-op.
8. [ ] `/ready` is `200`; `php artisan foundation:smoke`; spot-check an organization, a booking and the platform audit table (read-only).
9. [ ] Re-enable outbound effects deliberately: queues first, then scheduler, then mail and webhooks. Check failed jobs.
10. [ ] Keep the old cluster, untouched, until the incident closes; record its destruction date.
11. [ ] Post-incident: evidence record, timeline, follow-ups, and a new independent dump from the new cluster.
