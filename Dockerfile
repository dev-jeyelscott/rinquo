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
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS assets

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY vite.config.ts tsconfig.json ./
COPY resources ./resources
COPY public ./public
RUN npm run build

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

ENV APP_CACHE_ON_START=1

USER app
