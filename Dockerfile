# syntax=docker/dockerfile:1

# The tags and digests below were verified against the Docker Official Images
# registry on 2026-08-25. Dependabot owns routine digest refreshes; major PHP,
# PostgreSQL, and Redis upgrades remain an explicit compatibility decision.
FROM composer:2.10.2@sha256:4d71c3c2109c61d5415544264b59ad4087e4c5b7244481723664138fd36d5040 AS composer-bin

FROM php:8.4.24-cli-alpine3.24@sha256:26e3f1de7f6aa3e8ea15584d803c5e088c57df89ff02a3ecf2dc855a4282d8d7 AS php-cli-base

RUN set -eux; \
    apk add --no-cache \
        ca-certificates \
        freetype \
        icu-libs \
        libjpeg-turbo \
        libpng \
        libpq \
        libzip \
        oniguruma \
        sqlite-libs \
        su-exec; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        freetype-dev \
        icu-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libzip-dev \
        oniguruma-dev \
        postgresql-dev \
        sqlite-dev; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        zip; \
    apk del .build-deps; \
    update-ca-certificates

FROM php-cli-base AS composer-builder
WORKDIR /app

COPY --from=composer-bin /usr/bin/composer /usr/local/bin/composer
COPY composer.json composer.lock ./

# Keep the lockfile-only dependency layer independent of application source.
# Application Composer scripts are intentionally disabled until the runtime
# image has copied the source tree and can run package discovery explicitly.
RUN --mount=type=cache,target=/tmp/composer-cache,id=core2-composer,sharing=locked \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    composer install \
        --no-dev \
        --no-interaction \
        --no-progress \
        --prefer-dist \
        --optimize-autoloader \
        --no-scripts

# This target is self-contained so the profile-gated concurrency suite does
# not depend on a host vendor directory or a source bind mount.
FROM php-cli-base AS test-runner
WORKDIR /var/www/html

RUN apk add --no-cache postgresql-client

COPY --from=composer-bin /usr/bin/composer /usr/local/bin/composer
COPY composer.json composer.lock ./
RUN --mount=type=cache,target=/tmp/composer-cache,id=core2-composer-dev,sharing=locked \
    COMPOSER_CACHE_DIR=/tmp/composer-cache \
    composer install \
        --no-interaction \
        --no-progress \
        --prefer-dist \
        --optimize-autoloader \
        --no-scripts

COPY . .
COPY --chmod=0755 docker/test-entrypoint.sh /usr/local/bin/core2-test-entrypoint

RUN set -eux; \
    mkdir -p storage bootstrap/cache database; \
    chown -R www-data:www-data /var/www/html; \
    find storage bootstrap/cache database -type d -exec chmod 0770 {} \;; \
    find storage bootstrap/cache database -type f -exec chmod 0660 {} \;; \
    su-exec www-data php artisan package:discover --ansi

USER www-data
ENTRYPOINT ["/usr/local/bin/core2-test-entrypoint"]

FROM php-cli-base AS frontend-builder
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN apk add --no-cache nodejs npm

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm,id=core2-npm,sharing=locked \
    npm ci --no-audit --no-fund

COPY . .
COPY --from=composer-builder /app/vendor ./vendor

# Wayfinder invokes PHP during the Vite build. The application key here is a
# disposable build-only value; no .env file, runtime secret, or generated key
# is copied into the final image. The Reverb value is a public browser key.
ARG VITE_PUBLIC_REVERB_IDENTIFIER=core2-local-key
ARG VITE_REVERB_HOST=localhost
ARG VITE_REVERB_PORT=8080
ARG VITE_REVERB_SCHEME=http

RUN set -eux; \
    touch database/database.sqlite; \
    mkdir -p bootstrap/cache storage/framework/cache storage/framework/sessions storage/framework/views storage/logs; \
    export APP_ENV=local \
        APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
        APP_URL=http://localhost \
        DB_CONNECTION=sqlite \
        DB_DATABASE=database/database.sqlite \
        VITE_REVERB_APP_KEY="$VITE_PUBLIC_REVERB_IDENTIFIER" \
        VITE_REVERB_HOST="$VITE_REVERB_HOST" \
        VITE_REVERB_PORT="$VITE_REVERB_PORT" \
        VITE_REVERB_SCHEME="$VITE_REVERB_SCHEME"; \
    npm run build; \
    rm -f database/database.sqlite

FROM php:8.4.24-fpm-alpine3.24@sha256:5992f8b7433fe7fa96dfbf67746c86d6c41bc91e686eac38fe531c72a02e40e4 AS runtime

RUN set -eux; \
    apk add --no-cache \
        ca-certificates \
        curl \
        fcgi \
        freetype \
        icu-libs \
        libjpeg-turbo \
        libpng \
        libpq \
        libzip \
        nginx \
        oniguruma \
        sqlite-libs \
        su-exec \
        supervisor; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        freetype-dev \
        icu-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libzip-dev \
        oniguruma-dev \
        postgresql-dev \
        sqlite-dev; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        zip; \
    apk del .build-deps; \
    sed -i 's/^user nginx;/user www-data;/' /etc/nginx/nginx.conf; \
    update-ca-certificates

WORKDIR /var/www/html

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Copy only runtime application paths. Tests, mobile sources, CI metadata,
# documentation, and build-tool manifests do not belong in the production
# image. .dockerignore still governs the frontend and test stages above.
COPY --chown=www-data:www-data app ./app
COPY --chown=www-data:www-data bootstrap ./bootstrap
COPY --chown=www-data:www-data \
    artisan \
    composer.json \
    composer.lock \
    ./
COPY --chown=www-data:www-data config ./config
COPY --chown=www-data:www-data database ./database
COPY --chown=www-data:www-data public ./public
COPY --chown=www-data:www-data resources ./resources
COPY --chown=www-data:www-data routes ./routes

COPY --from=composer-builder --chown=www-data:www-data /app/vendor ./vendor
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build

RUN set -eux; \
    find /var/www/html -xdev -type d -exec chmod 0755 {} \;; \
    find /var/www/html -xdev -type f -exec chmod 0644 {} \;; \
    chmod 0755 /var/www/html; \
    rm -f bootstrap/cache/*.php; \
    mkdir -p storage bootstrap/cache database /var/log/supervisor; \
    chown -R www-data:www-data storage bootstrap/cache database; \
    find storage bootstrap/cache database -type d -exec chmod 0770 {} \;; \
    find storage bootstrap/cache database -type f -exec chmod 0660 {} \;; \
    su-exec www-data php artisan package:discover --ansi; \
    php-fpm -tt

EXPOSE 80 8080

# Supervisor remains root only because it must bind Nginx to port 80 and
# perform named-volume ownership setup. Nginx workers, PHP-FPM workers, queue,
# scheduler, and Reverb run as unprivileged users.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
