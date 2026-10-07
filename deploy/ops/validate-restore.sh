#!/usr/bin/env bash
#
# Validate a restored database. Read-only: the SQL runs in a READ ONLY transaction.
#
#   PGHOST=... PGDATABASE=... PGUSER=... PGPASSWORD=... validate-restore.sh [expected-migration-count]
#
# Prints one `check|status|detail` line per check and exits non-zero when any check fails.
# The expected migration count defaults to the number of files in database/migrations.

set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$here/lib.sh"

PSQL="${PSQL:-psql}"
require_command "${PSQL%% *}"
require_env PGHOST PGDATABASE PGUSER

expected="${1:-}"
if [[ -z "$expected" ]]; then
    expected="$(find "$here/../../database/migrations" -maxdepth 1 -name '*.php' | wc -l | tr -d ' ')"
fi
[[ "$expected" =~ ^[0-9]+$ ]] || die "expected migration count must be a number"

# shellcheck disable=SC2086
results="$($PSQL -X -v ON_ERROR_STOP=1 -At -F '|' -v "expected_migrations=${expected}" -f "$here/validate-restore.sql" | grep -E '^[^|]+\|(pass|fail)\|' || true)"
[[ -n "$results" ]] || die "validation produced no results"

printf '%s\n' "$results"

if grep -q '|fail|' <<<"$results"; then
    log "restore validation FAILED"
    exit 1
fi
log "restore validation passed ($(grep -c '|pass|' <<<"$results") checks)"
