#!/usr/bin/env bash
#
# Nightly independent logical backup of the production PostgreSQL database.
#
#   backup-dump.sh            (run by cron or a systemd timer on the VPS)
#
# Writes an encrypted custom-format pg_dump, its SHA-256 and a metadata manifest to a
# SEPARATE S3-compatible account from the application's media storage. The dump is encrypted
# with a public key, so this host cannot decrypt what it uploads; the private key stays with
# Operations. Month-end runs are also kept as a monthly object (12 months). Daily objects are
# kept 35 days. Expiry is best enforced by a bucket lifecycle rule (see docs/operations/backup-and-recovery.md);
# prune-backups.sh is the fallback and uses separate credentials.
#
# Environment (from the root-only env file, never committed and never printed):
#   RINQUO_BACKUP_ENV_FILE        env file to load (default /etc/rinquo/backup.env)
#   PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD   least-privilege backup role (read only)
#   PGSSLMODE=verify-full PGSSLROOTCERT=<provider CA file>
#   RINQUO_BACKUP_GPG_RECIPIENT   fingerprint of the backup public key
#   RINQUO_BACKUP_BUCKET RINQUO_BACKUP_ENDPOINT RINQUO_BACKUP_PREFIX   destination
#   AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY      write-scoped credentials for that bucket
#   RINQUO_BACKUP_HEARTBEAT_URL   optional dead-man's-switch URL; pinged on success, /fail on failure

set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

env_file="${RINQUO_BACKUP_ENV_FILE:-/etc/rinquo/backup.env}"
if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
fi

heartbeat() {
    [[ -n "${RINQUO_BACKUP_HEARTBEAT_URL:-}" ]] || return 0
    curl -fsS --max-time 10 -o /dev/null "${RINQUO_BACKUP_HEARTBEAT_URL}${1:-}" || log "heartbeat ping failed (non-fatal)"
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
trap 'heartbeat /fail; log "backup FAILED"' ERR

require_env PGHOST PGDATABASE PGUSER PGPASSWORD RINQUO_BACKUP_GPG_RECIPIENT RINQUO_BACKUP_BUCKET RINQUO_BACKUP_ENDPOINT RINQUO_BACKUP_PREFIX AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
[[ "${PGSSLMODE:-}" == "verify-full" ]] || die "PGSSLMODE must be verify-full (provider CA and hostname verification)"
[[ -n "${PGSSLROOTCERT:-}" && -f "${PGSSLROOTCERT}" ]] || die "PGSSLROOTCERT must point at the provider CA certificate file"
PG_DUMP="${PG_DUMP:-pg_dump}"
GPG="${GPG:-gpg}"
AWS="${AWS:-aws}"
require_command "${PG_DUMP%% *}" "${GPG%% *}" "${AWS%% *}" sha256sum

today="${RINQUO_BACKUP_TODAY:-$(date -u +%Y-%m-%d)}"
started="${today//-/}T$(date -u +%H%M%S)Z"
name="rinquo-${started}.dump.gpg"
file="$work/$name"

log "dumping $PGDATABASE (custom format, encrypted to the backup key)"
# shellcheck disable=SC2086
$PG_DUMP --format=custom --compress=6 --no-owner --no-privileges "$PGDATABASE" |
    $GPG --batch --yes --trust-model always --encrypt --recipient "$RINQUO_BACKUP_GPG_RECIPIENT" --output "$file"

[[ -s "$file" ]] || die "the encrypted dump is empty"
digest="$(sha256_of "$file")"
size="$(stat -c %s "$file")"
printf '%s  %s\n' "$digest" "$name" >"$work/$name.sha256"

# shellcheck disable=SC2086
pg_version="$($PG_DUMP --version | head -n1)"
finished="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
script_sha="$(sha256_of "${BASH_SOURCE[0]}")"
cat >"$work/$name.manifest.json" <<JSON
{
  "object": "$(json_escape "$name")",
  "database": "$(json_escape "$PGDATABASE")",
  "source_host": "$(json_escape "$PGHOST")",
  "started_utc": "${started}",
  "finished_utc": "${finished}",
  "size_bytes": ${size},
  "sha256": "${digest}",
  "pg_dump": "$(json_escape "$pg_version")",
  "format": "custom, gpg-encrypted",
  "recipient_fingerprint": "$(json_escape "$RINQUO_BACKUP_GPG_RECIPIENT")",
  "script_sha256": "${script_sha}"
}
JSON

dest_daily="s3://${RINQUO_BACKUP_BUCKET}/${RINQUO_BACKUP_PREFIX}/daily/${started:0:4}"
upload() {
    # shellcheck disable=SC2086
    $AWS --endpoint-url "$RINQUO_BACKUP_ENDPOINT" s3 cp --only-show-errors "$1" "$2"
}

log "uploading $name ($size bytes)"
for f in "$name" "$name.sha256" "$name.manifest.json"; do
    upload "$work/$f" "$dest_daily/$f"
done

if is_last_day_of_month "$today"; then
    monthly="rinquo-${today:0:4}${today:5:2}"
    dest_monthly="s3://${RINQUO_BACKUP_BUCKET}/${RINQUO_BACKUP_PREFIX}/monthly"
    log "month end: keeping a monthly copy"
    upload "$work/$name" "$dest_monthly/$monthly.dump.gpg"
    upload "$work/$name.sha256" "$dest_monthly/$monthly.dump.gpg.sha256"
    upload "$work/$name.manifest.json" "$dest_monthly/$monthly.dump.gpg.manifest.json"
fi

heartbeat
log "backup complete: $name sha256=$digest"
