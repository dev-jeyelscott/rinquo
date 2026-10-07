# Backup and recovery (production PostgreSQL)

Approved contract for the production database. A backup is not accepted until a
drill has restored it into an isolated target and validated it (see
[Drills](#drills)). Everything below is verified by `deploy/ops/tests/ops-test.sh`
except the managed-provider steps, which only a staging or production drill can
prove.

## Architecture

- One DigitalOcean VPS plus **Managed PostgreSQL 17** (one standby node) and
  **managed Redis**, in the same **SGP1** VPC. The databases accept connections
  only from the VPC and trusted sources (the VPS). Connections use TLS with
  `sslmode=verify-full` against the provider CA and hostname.
- The application connects with a least-privilege role. It owns the schema
  objects it migrates and has no superuser or replication rights.
- Native backups: **daily backup plus WAL-based point-in-time recovery (PITR)
  for 7 days**. A restore **always creates a new cluster**; it never overwrites
  production.
- **Independent logical dumps**: an encrypted nightly custom-format `pg_dump` to a
  separate, restricted S3-compatible account. Destroying the DigitalOcean source
  destroys its native backups, so these dumps are required, not optional.

## Objectives

| Objective | Target |
| --------- | ------ |
| RPO (maximum data loss) | 15 minutes |
| RTO (service restored) | 4 hours |
| Restored clone available | 2 hours |

The RPO is met by PITR (native). The nightly dump covers loss of the DigitalOcean
account or cluster, not the 15-minute objective.

## Independent dumps

`deploy/ops/backup-dump.sh` (run nightly by cron or a systemd timer on the VPS):

1. `pg_dump --format=custom` of the production database over `verify-full` TLS
   using a **read-only backup role**;
2. encrypts to the **backup public key** (GPG). The VPS holds only the public
   key, so it cannot decrypt what it uploads; the private key stays with
   Operations in a password manager or hardware token and is never on the VPS;
3. writes the `.sha256` and a `.manifest.json` (object name, source host,
   timestamps, size, SHA-256, `pg_dump` version, key fingerprint, script
   checksum; no contents or credentials);
4. uploads all three with **write-scoped credentials** to a bucket in a
   **separate account** from the application media bucket;
5. on the last day of the month also uploads a monthly copy;
6. pings `RINQUO_BACKUP_HEARTBEAT_URL` on success (and `/fail` on failure). Use a
   dead-man's-switch monitor so a **missed run alerts**.

Retention: daily **35 days**, month-end **12 months**. Prefer a bucket lifecycle
rule (no delete permission for the uploader). `deploy/ops/prune-backups.sh` is
the fallback; it needs delete permission and therefore uses **different
credentials** from the uploader. Run it with `--dry-run` first.

Host files (root-only, mode `0600`, never committed): `/etc/rinquo/backup.env`
(and `/etc/rinquo/prune.env`). Variable names and purpose are in the script
headers; values are never printed by the scripts.

```cron
# /etc/cron.d/rinquo-backup  (03:15 UTC daily; adjust the paths)
15 3 * * * deploy /opt/rinquo/ops/backup-dump.sh >>/var/log/rinquo-backup.log 2>&1
```

Install the scripts from the release you deploy (`deploy/ops/*.sh`, `lib.sh`),
plus `pg_dump` 17, `gpg` and `aws` (CLI v2) on the host.

## Drills

Run a drill **before launch, quarterly, and after any material change** (database
version, provider plan, schema-wide migration, backup tooling, key rotation).
**Operations runs drills.** Use the evidence template
[templates/restore-drill-record.md](templates/restore-drill-record.md).

Two drill paths; do both before launch:

### A. Native PITR (proves the provider's recovery)

1. Open a drill ticket; pick a recovery time inside the last 7 days.
2. In the DigitalOcean control panel (or `doctl databases fork`) create a **new**
   cluster from the production cluster at that point in time, in the same VPC
   or a drill VPC, **with no application attached**. Start the stopwatch for the
   2-hour "clone available" objective.
3. Add only the operator's IP as a trusted source. Create a drill user. Download
   the provider CA.
4. Run `deploy/ops/restore-drill.sh --mode pitr` (environment in its header:
   `RINQUO_DRILL_PGHOST`, `RINQUO_PITR_TARGET_TIME_UTC`, ticket, operator and so on).
   It validates read-only and writes the evidence JSON.
5. Clean up (below).

### B. Independent dump (proves the dump, the key and the tooling)

1. On a workstation holding the backup **private key**, download one dump, its
   `.sha256` and manifest from the backup bucket.
2. Create a **new, empty** managed cluster (or a new database on a drill cluster).
3. Run `deploy/ops/restore-drill.sh --mode dump --dump <file.dump.gpg>`. It
   verifies the checksum, decrypts, creates a **new** database (refusing an
   existing one), runs `pg_restore --exit-on-error`, validates and records evidence.
4. Clean up (below).

### What every drill validates (read-only, `deploy/ops/validate-restore.sql`)

TLS and connectivity (`verify-full`); roles and installed extensions;
database version; every migration recorded (count equals the repository's
migration files); all constraints validated (so foreign keys hold) and foreign
keys exist; **tenant-scope samples** (no tenant-owned row without
`organization_id`); private media references are object keys, never URLs; the
append-only audit and plan-term triggers survived; representative record counts.
Optionally (`RINQUO_DRILL_APP_IMAGE`) a read-only `php artisan migrate:status`
from the release image with **mail, queues, Reverb, payment and telemetry
disabled**. No business journey that mutates data is run.

### Isolation rules (enforced by the script)

- The target must be a **new, isolated cluster**. The script refuses the
  production host (case-insensitive) and an existing database.
- Mail, webhooks, queues, Reverb and every other outbound effect are disabled.
  Use drill-only credentials and send no production traffic to the clone.
- Never point `DB_HOST` of a running application at a drill clone unless it is an
  approved cutover (below).

### Evidence and cleanup

Keep the evidence **24 months**: source or PITR time, target, operators and
approvers, objective timings (clone available, restore, total), the command
version and checksum, results, deviations, cleanup proof and the ticket. Never
store contents, PII, secrets or private URLs. The script writes the metadata
JSON; attach it to the ticket.

**Destroy the clone and revoke every drill credential and trusted source within
24 hours**, and attach proof (provider audit entry or screenshot, plus the
credential revocation). Alert if the drill record has no cleanup proof after 24
hours. Never destroy the DigitalOcean *production* cluster without first
confirming a verified independent dump exists.

## Real recovery (incident) and cutover

Use the same restore into a **new** cluster. Production cutover (pointing the
application at the restored cluster) requires the **incident commander and a
second authorized approver**, recorded in the ticket, and the script's explicit
`--cutover` mode (`RINQUO_CUTOVER_INCIDENT_COMMANDER` and a different
`RINQUO_CUTOVER_APPROVER`). Use [templates/cutover-checklist.md](templates/cutover-checklist.md).
After cutover, update `DB_HOST` in `app.env`, redeploy the current release
(`deploy.sh`), verify `/ready`, `foundation:smoke` and a read-only spot check,
then keep the old cluster until the incident is closed.

## Media

PostgreSQL recovery does not restore media. Object storage recovery and
versioning are a separate responsibility; see [runbooks.md](runbooks.md#object-storage-incident).
