#!/usr/bin/env bash
#
# Restore drill: prove a backup can be restored into a NEW, isolated PostgreSQL target, then
# validate it read-only and record evidence. It never restores over production and refuses a
# target that looks like production unless an explicit, approved cutover is declared.
#
#   restore-drill.sh --mode dump --dump <rinquo-....dump.gpg> [--sha256 <file>] [--evidence-dir <dir>]
#   restore-drill.sh --mode pitr [--evidence-dir <dir>]
#
# dump  Decrypt (needs the backup PRIVATE key, held by Operations, never on the VPS), verify the
#       checksum, create an empty database on the target and pg_restore into it.
# pitr  The target is a cluster already forked from the managed cluster at a point in time (created
#       in the provider console or CLI); only validation and evidence run.
#
# Environment (never committed, never printed):
#   RINQUO_DRILL_TICKET RINQUO_DRILL_OPERATOR        evidence identity
#   RINQUO_DRILL_PGHOST PGPORT RINQUO_DRILL_PGUSER RINQUO_DRILL_PGPASSWORD RINQUO_DRILL_PGDATABASE
#   RINQUO_DRILL_PGSSLROOTCERT                       provider CA (verify-full is always used)
#   RINQUO_PRODUCTION_PGHOST                         the production host name this script must refuse
#   RINQUO_PITR_TARGET_TIME_UTC                      required for --mode pitr (the point in time that was forked)
#   RINQUO_DRILL_APP_IMAGE                           optional: also run a read-only application health check
# Approved cutover (the only way to touch a production-like target):
#   --cutover with RINQUO_CUTOVER_INCIDENT_COMMANDER and a DIFFERENT RINQUO_CUTOVER_APPROVER

set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

mode="" dump="" sha_file="" evidence_dir="${RINQUO_DRILL_EVIDENCE_DIR:-./drill-evidence}" cutover=0
while (($#)); do
    case "$1" in
        --mode) mode="${2:-}"; shift 2 ;;
        --dump) dump="${2:-}"; shift 2 ;;
        --sha256) sha_file="${2:-}"; shift 2 ;;
        --evidence-dir) evidence_dir="${2:-}"; shift 2 ;;
        --cutover) cutover=1; shift ;;
        *) die "unknown argument: $1" ;;
    esac
done
[[ "$mode" == "dump" || "$mode" == "pitr" ]] || die "--mode must be dump or pitr"

require_env RINQUO_DRILL_TICKET RINQUO_DRILL_OPERATOR RINQUO_DRILL_PGHOST RINQUO_DRILL_PGUSER RINQUO_DRILL_PGPASSWORD RINQUO_DRILL_PGDATABASE RINQUO_DRILL_PGSSLROOTCERT RINQUO_PRODUCTION_PGHOST
[[ -f "$RINQUO_DRILL_PGSSLROOTCERT" ]] || die "RINQUO_DRILL_PGSSLROOTCERT must be a CA certificate file"

# --- Isolation guards -------------------------------------------------------------------------
if [[ "${RINQUO_DRILL_PGHOST,,}" == "${RINQUO_PRODUCTION_PGHOST,,}" ]]; then
    if ((cutover)); then
        require_env RINQUO_CUTOVER_INCIDENT_COMMANDER RINQUO_CUTOVER_APPROVER
        [[ "$RINQUO_CUTOVER_INCIDENT_COMMANDER" != "$RINQUO_CUTOVER_APPROVER" ]] || die "cutover needs a second, different authorized approver"
        log "APPROVED CUTOVER mode: commander=${RINQUO_CUTOVER_INCIDENT_COMMANDER} approver=${RINQUO_CUTOVER_APPROVER}"
    else
        die "refusing: the target host is the production host. A drill restores to a new isolated cluster only."
    fi
elif ((cutover)); then
    die "--cutover is only meaningful for a production target"
fi
[[ "$RINQUO_DRILL_PGDATABASE" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || die "invalid target database name"

export PSQL="${PSQL:-psql}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
CREATEDB="${CREATEDB:-createdb}"
GPG="${GPG:-gpg}"
require_command "${PSQL%% *}"

export PGHOST="$RINQUO_DRILL_PGHOST" PGUSER="$RINQUO_DRILL_PGUSER" PGPASSWORD="$RINQUO_DRILL_PGPASSWORD"
export PGSSLMODE=verify-full PGSSLROOTCERT="$RINQUO_DRILL_PGSSLROOTCERT"
export PGPORT="${RINQUO_DRILL_PGPORT:-25060}"
export PGDATABASE="$RINQUO_DRILL_PGDATABASE"

started_epoch="$(date -u +%s)"
started_utc="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
source_note=""
backup_object=""

if [[ "$mode" == "dump" ]]; then
    [[ -f "$dump" ]] || die "--dump must be an existing file"
    require_command "${PG_RESTORE%% *}" "${CREATEDB%% *}" "${GPG%% *}" sha256sum
    backup_object="$(basename "$dump")"

    # 1. Integrity before anything else.
    sha_file="${sha_file:-$dump.sha256}"
    [[ -f "$sha_file" ]] || die "checksum file not found: $sha_file"
    expected_sha="$(awk '{print $1}' "$sha_file")"
    [[ "$(sha256_of "$dump")" == "$expected_sha" ]] || die "checksum mismatch: the dump is damaged or was altered"
    log "checksum verified"

    # 2. A new, empty database: never an existing one, never overwritten.
    existing="$($PSQL -X -At -d postgres -c "select 1 from pg_database where datname = '${RINQUO_DRILL_PGDATABASE}'" || true)"
    [[ -z "$existing" ]] || die "database ${RINQUO_DRILL_PGDATABASE} already exists on the target; a drill restores into a new database only"
    # shellcheck disable=SC2086
    $CREATEDB "$RINQUO_DRILL_PGDATABASE"

    # 3. Decrypt to memory-backed temp and restore. --exit-on-error: a partial restore is a failed drill.
    restore_started="$(date -u +%s)"
    # shellcheck disable=SC2086
    $GPG --batch --quiet --decrypt "$dump" >"$work/restore.dump"
    # shellcheck disable=SC2086
    $PG_RESTORE --exit-on-error --no-owner --no-privileges --dbname "$RINQUO_DRILL_PGDATABASE" "$work/restore.dump"
    rm -f "$work/restore.dump"
    restore_seconds=$(($(date -u +%s) - restore_started))
    source_note="logical dump"
else
    require_env RINQUO_PITR_TARGET_TIME_UTC
    restore_seconds=0
    source_note="managed point-in-time fork at ${RINQUO_PITR_TARGET_TIME_UTC}"
fi

# --- Read-only validation -----------------------------------------------------------------
validation_status="passed"
validation_output="$("$here/validate-restore.sh" 2>"$work/validate.err")" || validation_status="failed"
cat "$work/validate.err" >&2 || true
printf '%s\n' "$validation_output"

# --- Optional read-only application health with every outbound effect disabled -----------------
health_status="skipped"
if [[ -n "${RINQUO_DRILL_APP_IMAGE:-}" ]]; then
    require_command docker
    if docker run --rm \
        -e APP_ENV=drill -e APP_KEY="base64:$(head -c 32 /dev/zero | base64)" -e APP_DEBUG=false \
        -e DB_CONNECTION=pgsql -e DB_HOST="$PGHOST" -e DB_PORT="$PGPORT" -e DB_DATABASE="$RINQUO_DRILL_PGDATABASE" \
        -e DB_USERNAME="$PGUSER" -e DB_PASSWORD="$PGPASSWORD" -e DB_SSLMODE=verify-full \
        -e MAIL_MAILER=array -e QUEUE_CONNECTION=null -e BROADCAST_CONNECTION=null -e CACHE_STORE=array -e SESSION_DRIVER=array \
        -e PAYMONGO_SECRET_KEY= -e PAYMONGO_WEBHOOK_SECRET= -e RESEND_API_KEY= -e SENTRY_LARAVEL_DSN= -e SENTRY_BROWSER_DSN= \
        "$RINQUO_DRILL_APP_IMAGE" php artisan migrate:status --no-interaction >/dev/null; then
        health_status="passed"
    else
        health_status="failed"
    fi
fi

total_seconds=$(($(date -u +%s) - started_epoch))

# --- Evidence (metadata only: no contents, credentials, PII or private URLs) --------------------
mkdir -p "$evidence_dir"
evidence="$evidence_dir/restore-drill-${RINQUO_DRILL_TICKET//[^A-Za-z0-9._-]/_}-$(date -u +%Y%m%dT%H%M%SZ).json"
scripts_sha="$(cat "$here/lib.sh" "$here/restore-drill.sh" "$here/validate-restore.sh" "$here/validate-restore.sql" | sha256sum | awk '{print $1}')"
checks_json="$(printf '%s\n' "$validation_output" | awk -F'|' 'NF>=3 {gsub(/"/, "\\\"", $3); printf "%s    {\"check\": \"%s\", \"status\": \"%s\", \"detail\": \"%s\"}", (n++ ? ",\n" : ""), $1, $2, $3}')"
cat >"$evidence" <<JSON
{
  "ticket": "$(json_escape "$RINQUO_DRILL_TICKET")",
  "mode": "${mode}",
  "source": "$(json_escape "$source_note")",
  "backup_object": "$(json_escape "$backup_object")",
  "pitr_target_time_utc": "$(json_escape "${RINQUO_PITR_TARGET_TIME_UTC:-}")",
  "target_host": "$(json_escape "$RINQUO_DRILL_PGHOST")",
  "target_database": "$(json_escape "$RINQUO_DRILL_PGDATABASE")",
  "operator": "$(json_escape "$RINQUO_DRILL_OPERATOR")",
  "cutover": $( ((cutover)) && echo true || echo false ),
  "incident_commander": "$(json_escape "${RINQUO_CUTOVER_INCIDENT_COMMANDER:-}")",
  "second_approver": "$(json_escape "${RINQUO_CUTOVER_APPROVER:-}")",
  "started_utc": "${started_utc}",
  "restore_seconds": ${restore_seconds},
  "total_seconds": ${total_seconds},
  "objectives": {"rpo_minutes": 15, "rto_hours": 4, "clone_available_hours": 2},
  "scripts_sha256": "${scripts_sha}",
  "validation": "${validation_status}",
  "application_health": "${health_status}",
  "checks": [
${checks_json}
  ],
  "deviations": [],
  "cleanup": {"status": "pending", "due_utc": "$(date -u -d '+24 hours' +%Y-%m-%dT%H:%M:%SZ)"}
}
JSON
log "evidence written: $evidence"
log "NEXT: destroy the drill target, revoke its credentials within 24 hours, and attach cleanup proof to ticket ${RINQUO_DRILL_TICKET}"

[[ "$validation_status" == "passed" && "$health_status" != "failed" ]] || exit 1
