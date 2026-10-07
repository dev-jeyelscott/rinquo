#!/usr/bin/env bash
# Shared helpers for the backup and restore-drill scripts. Sourced, never executed.
# Nothing here prints a secret: values from the environment are only ever tested for presence.

OPS_LIB_VERSION="1"

log() {
    printf '[ops %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2
}

die() {
    log "error: $*"
    exit 1
}

# require_env NAME...  Fails (naming the variables, never their values) when any is empty.
require_env() {
    local missing=() name
    for name in "$@"; do
        [[ -n "${!name:-}" ]] || missing+=("$name")
    done
    ((${#missing[@]} == 0)) || die "missing required environment: ${missing[*]}"
}

# require_command NAME...
require_command() {
    local name
    for name in "$@"; do
        command -v "$name" >/dev/null 2>&1 || die "required command not found: $name"
    done
}

# utc_date_offset YYYY-MM-DD +/-N unit  -> YYYY-MM-DD (GNU date)
utc_date_offset() {
    date -u -d "$1 $2" +%Y-%m-%d
}

# is_last_day_of_month YYYY-MM-DD
is_last_day_of_month() {
    [[ "$(date -u -d "$1 +1 day" +%d)" == "01" ]]
}

# object_date KEY -> the YYYY-MM-DD (daily) or last day of the month (monthly) encoded in a backup object name; empty when none.
object_date() {
    local name="${1##*/}"
    if [[ "$name" =~ rinquo-([0-9]{4})([0-9]{2})([0-9]{2})T[0-9]{6}Z\. ]]; then
        printf '%s-%s-%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
    elif [[ "$name" =~ rinquo-([0-9]{4})([0-9]{2})\. ]]; then
        # A monthly object is the month-end copy: it dates from the last day of its month.
        date -u -d "${BASH_REMATCH[1]}-${BASH_REMATCH[2]}-01 +1 month -1 day" +%Y-%m-%d
    fi
}

# expired_keys TIER TODAY  reads object keys on stdin and prints those past retention.
# daily: kept 35 days. monthly (month-end): kept 12 months. Unknown names are never deleted.
expired_keys() {
    local tier="$1" today="$2" cutoff key date
    case "$tier" in
        daily) cutoff="$(utc_date_offset "$today" '-35 days')" ;;
        monthly) cutoff="$(utc_date_offset "$today" '-12 months')" ;;
        *) die "unknown retention tier: $tier" ;;
    esac
    while IFS= read -r key; do
        date="$(object_date "$key")"
        [[ -n "$date" ]] || continue
        [[ "$date" < "$cutoff" ]] && printf '%s\n' "$key"
    done
    return 0
}

# sha256_of FILE -> hex digest
sha256_of() {
    sha256sum "$1" | awk '{print $1}'
}

# json_escape STRING (for the few free-text manifest fields)
json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/ }"
    printf '%s' "$s"
}
