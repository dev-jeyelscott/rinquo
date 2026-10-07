# syntax=docker/dockerfile:1

# One image definition for every environment.
#   dev        - local development (bind-mounted source, runs as the host user)
#   production - immutable release image for staging and production
# The production image runs every process (web, horizon, scheduler, reverb)
# with a different command.

ARG FRANKENPHP_IMAGE=dunglas/frankenphp:1.12.7-php8.5.11-trixie
ARG NODE_IMAGE=node:24.21.0-trixie-slim
ARG COMPOSER_IMAGE=composer:2.10.3

FROM ${COMPOSER_IMAGE} AS composer

# ---------------------------------------------------------------------------
# base: PHP runtime (FrankenPHP classic mode) shared by dev and production
# ---------------------------------------------------------------------------
FROM ${FRANKENPHP_IMAGE} AS base

ARG APP_UID=1000
ARG APP_GID=1000

RUN install-php-extensions pdo_pgsql redis pcntl intl zip bcmath opcache \
    && groupadd --non-unique --gid "${APP_GID}" app \
    && useradd --non-unique --uid "${APP_UID}" --gid "${APP_GID}" --create-home --shell /bin/sh app \
    && setcap CAP_NET_BIND_SERVICE=+eip /usr/local/bin/frankenphp \
    && chown -R app:app /data/caddy /config/caddy

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY docker/Caddyfile /etc/frankenphp/Caddyfile
COPY docker/php/app.ini "${PHP_INI_DIR}/conf.d/zz-app.ini"
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/app-entrypoint

# Plain HTTP on port 80 unless SERVER_NAME is set to a hostname (production),
# in which case Caddy obtains and renews a TLS certificate automatically.
ENV SERVER_NAME=:80

WORKDIR /app

# The base image's health check only fits the web process; each Compose
# service defines a check that matches its own process instead.
HEALTHCHECK NONE

ENTRYPOINT ["app-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile", "--adapter", "caddyfile"]

# ---------------------------------------------------------------------------
# dev: source is bind-mounted; dependencies are installed by `make setup`
# ---------------------------------------------------------------------------
FROM base AS dev

RUN cp "${PHP_INI_DIR}/php.ini-development" "${PHP_INI_DIR}/php.ini"

USER app

# ---------------------------------------------------------------------------
# vendor: production Composer dependencies
# ---------------------------------------------------------------------------
FROM base AS vendor

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

# ---------------------------------------------------------------------------
# assets: Vite production build (no build-time environment values are baked
# in; realtime settings are shared at runtime)
#
# Release builds (SENTRY_RELEASE set and a sentry_auth_token BuildKit secret
# present) build hidden source maps, inject debug ids, upload the maps to the
# browser Sentry project for this release, and delete every .map file before
# the stage ends. The token exists only in the RUN's secret mount: it is never
# an ARG, ENV or layer, and the public bundle and the final image contain no maps.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS assets

ARG SENTRY_CLI_VERSION=3.8.0
ARG SENTRY_RELEASE=""
ARG SENTRY_ORG=""
ARG SENTRY_BROWSER_PROJECT=""

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY vite.config.ts tsconfig.json ./
COPY resources ./resources
COPY public ./public
RUN --mount=type=secret,id=sentry_auth_token,required=false \
    set -eu; \
    if [ -n "${SENTRY_RELEASE}" ] && [ -s /run/secrets/sentry_auth_token ]; then \
        SOURCEMAP=hidden npm run build; \
        export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; \
        npx --yes "@sentry/cli@${SENTRY_CLI_VERSION}" sourcemaps inject public/build; \
        npx --yes "@sentry/cli@${SENTRY_CLI_VERSION}" sourcemaps upload \
            --org "${SENTRY_ORG}" --project "${SENTRY_BROWSER_PROJECT}" --release "${SENTRY_RELEASE}" public/build; \
        find public/build -name '*.map' -delete; \
        unset SENTRY_AUTH_TOKEN; \
    else \
        npm run build; \
    fi; \
    ! find public/build -name '*.map' | grep -q .

# ---------------------------------------------------------------------------
# production: immutable, non-root release image
# ---------------------------------------------------------------------------
FROM base AS production

RUN cp "${PHP_INI_DIR}/php.ini-production" "${PHP_INI_DIR}/php.ini"
COPY docker/php/production.ini "${PHP_INI_DIR}/conf.d/zz-production.ini"

COPY --from=vendor /app/vendor ./vendor
COPY . .
COPY --from=assets /app/public/build ./public/build

# APP_ENV=build: package discovery boots the app without deployment config, so
# keep the staging/production required-environment check out of the build.
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts \
    && APP_ENV=build php artisan package:discover --ansi \
    && mkdir -p storage/app/private storage/framework/cache/data storage/framework/sessions \
        storage/framework/views storage/logs bootstrap/cache \
    && chown -R app:app storage bootstrap/cache

# The one immutable release id (the commit SHA) shared by backend reports, browser reports and
# the uploaded source maps. Empty for local and pull-request builds.
ARG SENTRY_RELEASE=""
ENV SENTRY_RELEASE=${SENTRY_RELEASE}

ENV APP_CACHE_ON_START=1

USER app
