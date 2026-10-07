# Staging smoke checklist

Run after every staging deploy of a release that is a promotion candidate.
Use test credentials and test recipients only: no live billing, no real customer mail.

1. [ ] `/up` is `200` and `/ready` is `200` with `{"status":"ok"}`.
2. [ ] `docker compose -f compose.production.yaml exec web php artisan foundation:smoke` passes (add `--mail-to=<Resend test address>` for the mail check).
3. [ ] Horizon is running: `... exec horizon php artisan horizon:status` reports running; the scheduler container is up.
4. [ ] Reverb: a browser session receives a live booking update.
5. [ ] Private object round trip: upload an organization logo and fetch it through the application (never a public URL).
6. [ ] Resend: a sign-in code email reaches the test recipient.
7. [ ] PayMongo (test mode): create a renewal QR, complete a test payment, the Owner sees the new paid-through date exactly once; replay the signed webhook and confirm no duplicate effect.
8. [ ] Sentry: `platform:verify-telemetry` event and the browser console event arrive with this release, `staging` environment, symbolicated stack, and no canary text (see monitoring.md).
9. [ ] Platform: an administrator signs in with password plus authenticator, opens an organization, starts a read-only support session, and the persistent banner and exit work.
10. [ ] Failure exercises (one per release or on change): stop Redis, then `reverb`, then deliver a failing webhook; confirm safe failure, the alert, and recovery per [runbooks.md](../runbooks.md).
11. [ ] Record the date, operator and release SHA in the release ticket.
