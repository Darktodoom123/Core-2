FROM composer:2-alpine AS composer-builder
WORKDIR /app

RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) gd

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
# This target intentionally contains only the PHP runtime needed by the
# PostgreSQL row-lock tests. Compose mounts the working tree and its existing
# development dependencies, so the production image stays production-only.
FROM php:8.4-cli-alpine AS test-runner

RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    icu-dev \
    oniguruma-dev \
    sqlite-dev \
    postgresql-dev \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        bcmath \
        mbstring \
        zip \
        pcntl \
        gd \
        intl

WORKDIR /var/www/html

FROM php:8.4-cli-alpine AS frontend-builder
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache nodejs npm

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
COPY --from=composer-builder /app/vendor ./vendor

ARG VITE_REVERB_APP_KEY
ARG VITE_REVERB_HOST=localhost
ARG VITE_REVERB_PORT=8080
ARG VITE_REVERB_SCHEME=http

ENV VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY} \
    VITE_REVERB_HOST=${VITE_REVERB_HOST} \
    VITE_REVERB_PORT=${VITE_REVERB_PORT} \
    VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME}

RUN cp .env.example .env \
    && php artisan key:generate --force \
    && touch database/database.sqlite \
    && npm run build \
    && rm -f .env database/database.sqlite

FROM php:8.4-fpm-alpine AS runtime

RUN apk update && apk upgrade --no-cache \
    && apk add --no-cache \
    nginx \
    supervisor \
    curl \
    git \
    unzip \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    icu-dev \
    oniguruma-dev \
    sqlite-dev \
    postgresql-dev \
    fcgi

RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        pdo_pgsql \
        pdo_sqlite \
        bcmath \
        mbstring \
        zip \
        pcntl \
        opcache \
        gd \
        intl

WORKDIR /var/www/html

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY --chown=www-data:www-data . .

COPY --from=composer-builder --chown=www-data:www-data /app/vendor ./vendor
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build

RUN rm -f bootstrap/cache/*.php \
    && php artisan package:discover --ansi

RUN mkdir -p storage bootstrap/cache database /var/log/supervisor \
    && chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 80 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
