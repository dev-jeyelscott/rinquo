#!/usr/bin/env bash
#
# Fallback retention for the independent dumps (prefer a bucket lifecycle rule).
# Deletes daily objects older than 35 days and monthly objects older than 12 months. It
# needs delete permission, so it runs with a SEPARATE credential from the uploader.
#
#   prune-backups.sh [--dry-run]
#
# Environment: RINQUO_PRUNE_ENV_FILE (default /etc/rinquo/prune.env), RINQUO_BACKUP_BUCKET,
# RINQUO_BACKUP_ENDPOINT, RINQUO_BACKUP_PREFIX, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.

set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

dry_run=0
[[ "${1:-}" == "--dry-run" ]] && dry_run=1

env_file="${RINQUO_PRUNE_ENV_FILE:-/etc/rinquo/prune.env}"
if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
fi

require_env RINQUO_BACKUP_BUCKET RINQUO_BACKUP_ENDPOINT RINQUO_BACKUP_PREFIX AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
AWS="${AWS:-aws}"
require_command "${AWS%% *}"

today="${RINQUO_TODAY:-$(date -u +%Y-%m-%d)}"
base="s3://${RINQUO_BACKUP_BUCKET}/${RINQUO_BACKUP_PREFIX}"

for tier in daily monthly; do
    # shellcheck disable=SC2086
    keys="$($AWS --endpoint-url "$RINQUO_BACKUP_ENDPOINT" s3 ls --recursive "$base/$tier/" | awk '{print $4}')"
    [[ -n "$keys" ]] || continue
    while IFS= read -r key; do
        if ((dry_run)); then
            log "would delete $key"
        else
            # shellcheck disable=SC2086
            $AWS --endpoint-url "$RINQUO_BACKUP_ENDPOINT" s3 rm --only-show-errors "s3://${RINQUO_BACKUP_BUCKET}/$key"
            log "deleted $key"
        fi
    done < <(printf '%s\n' "$keys" | expired_keys "$tier" "$today")
done
