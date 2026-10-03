#!/bin/sh
set -eu

# The production image sets APP_CACHE_ON_START=1: cache configuration, events,
# routes and views when a container starts. Booting the application here also
# runs the staging/production required-environment check, so a missing
# variable stops the container and names the missing config keys.
if [ "${APP_CACHE_ON_START:-0}" = "1" ]; then
    php artisan optimize --ansi
fi

exec "$@"
