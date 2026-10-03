#!/usr/bin/env bash
#
# Deploy one immutable image to this host. Used for staging and production.
#
#   RINQUO_READY_URL=https://staging.example.com/ready ./deploy.sh ghcr.io/owner/rinquo@sha256:<digest>
#
# Order: pull -> migrate with the NEW image (running services untouched) ->
# switch services -> verify /ready -> on failure, switch back to the
# previous image. Rollback never reverses migrations, so every migration
# must be backward compatible with the previous release (expand/contract).
#
# Environment:
#   RINQUO_READY_URL      required; public readiness URL checked after the switch
#   RINQUO_READY_TIMEOUT  seconds to wait for readiness (default 120)
#   RINQUO_SKIP_PULL=1    use a locally present image (local rehearsal only)
#   RINQUO_APP_ENV_FILE   application env file (default ./app.env)
#   RINQUO_COMPOSE_PROJECT       Compose project name (default rinquo)
#   RINQUO_COMPOSE_EXTRA_FILE    optional host-specific Compose override file
#   RINQUO_HTTP_PORT / RINQUO_HTTPS_PORT  published ports (default 80 / 443)

set -euo pipefail

usage() {
    echo "usage: RINQUO_READY_URL=<url> $0 <image-reference>" >&2
    exit 2
}

log() {
    printf '[deploy %s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

[[ $# -eq 1 ]] || usage
image="$1"
ready_url="${RINQUO_READY_URL:-}"
ready_timeout="${RINQUO_READY_TIMEOUT:-120}"

# Only accept a plain image reference (no whitespace or shell metacharacters).
if [[ ! "$image" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]]; then
    echo "invalid image reference" >&2
    exit 2
fi
[[ -n "$ready_url" ]] || { echo "RINQUO_READY_URL is required" >&2; exit 2; }
[[ "$ready_timeout" =~ ^[0-9]+$ ]] || { echo "RINQUO_READY_TIMEOUT must be a number of seconds" >&2; exit 2; }

cd "$(dirname "$0")"

app_env_file="${RINQUO_APP_ENV_FILE:-./app.env}"
[[ -f "$app_env_file" ]] || { echo "application env file not found: $app_env_file" >&2; exit 2; }

compose=(docker compose -p "${RINQUO_COMPOSE_PROJECT:-rinquo}" -f compose.production.yaml)
if [[ -n "${RINQUO_COMPOSE_EXTRA_FILE:-}" ]]; then
    compose+=(-f "$RINQUO_COMPOSE_EXTRA_FILE")
fi
services=(web horizon scheduler reverb)
state_file=.current-image

# One deploy at a time on this host.
exec 9>.deploy.lock
flock -n 9 || { echo "another deploy is in progress" >&2; exit 1; }

# 1. Record the image that is serving now (empty on the first deploy).
previous="$(cat "$state_file" 2>/dev/null || true)"
web_container="$(RINQUO_IMAGE="${previous:-unset}" "${compose[@]}" ps -q web 2>/dev/null || true)"
if [[ -n "$web_container" ]]; then
    previous="$(docker inspect --format '{{.Config.Image}}' "$web_container")"
fi
log "previous image: ${previous:-<none>}"
log "new image: $image"

# 2. Pull the new image.
if [[ "${RINQUO_SKIP_PULL:-0}" != "1" ]]; then
    docker pull --quiet "$image" >/dev/null
fi

# 3. Migrate in a one-off container from the new image. On failure the
#    running services are not touched.
log "running migrations"
if ! RINQUO_IMAGE="$image" "${compose[@]}" run --rm --no-deps web php artisan migrate --force --no-interaction; then
    log "migration failed; running services were not changed"
    exit 1
fi

switch_to() {
    RINQUO_IMAGE="$1" "${compose[@]}" up -d --no-build --remove-orphans "${services[@]}"
}

wait_until_ready() {
    local deadline=$((SECONDS + ready_timeout))
    while ((SECONDS < deadline)); do
        if curl -fsS --max-time 5 -o /dev/null "$ready_url"; then
            return 0
        fi
        sleep 3
    done
    return 1
}

# 4. Switch every process to the new image (entrypoint caches config,
#    routes and views; Horizon workers stop gracefully).
log "starting services on the new image"
if switch_to "$image" && wait_until_ready; then
    # 5. Ready: record the new release.
    printf '%s\n' "$image" >"$state_file"
    log "deploy succeeded: $image"
    exit 0
fi

# 5. Not ready (or failed to start): roll back to the previous image.
log "new release did not become ready within ${ready_timeout}s"
if [[ -n "$previous" ]]; then
    log "rolling back to $previous"
    if switch_to "$previous" && wait_until_ready; then
        log "rollback complete; previous release is serving"
    else
        log "rollback did not become ready; manual intervention required"
    fi
else
    log "no previous release to roll back to; manual intervention required"
fi
exit 1
