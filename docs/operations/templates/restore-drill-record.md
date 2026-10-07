# Restore drill record

Retain 24 months. Metadata only: no database contents, PII, credentials, secrets
or private URLs. The JSON written by `restore-drill.sh` is attached to this record.

| Field | Value |
| ----- | ----- |
| Ticket | |
| Drill type | before launch / quarterly / after material change: ______ |
| Path | native PITR / independent dump |
| Operator(s) | |
| Source (PITR target time UTC, or dump object and its manifest SHA-256) | |
| Target (host, database; confirm it is a NEW isolated cluster) | |
| `restore-drill.sh` version (git SHA) and `scripts_sha256` from the evidence JSON | |
| Clone available after (objective: 2 hours) | |
| Restore + validation time (objective RTO: 4 hours) | |
| Data loss window measured (objective RPO: 15 minutes) | |
| Validation result (attach evidence JSON; all checks pass?) | |
| Read-only application health (migrate:status, outbound disabled) | |
| Deviations and follow-ups | |
| Cleanup: clone destroyed at (UTC, within 24 h) | |
| Cleanup: drill credentials and trusted sources revoked at (UTC) | |
| Cleanup proof attached (provider audit entry or screenshot) | |
| Reviewed by | |
