FROM composer:2 AS composer-builder
WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

FROM node:22-alpine AS frontend-builder
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN apk add --no-cache \
    ca-certificates \
    gcompat \
    libc6-compat \
    php84 \
    php84-cli \
    php84-phar \
    php84-mbstring \
    php84-openssl \
    php84-tokenizer \
    php84-xml \
    php84-ctype \
    php84-json \
    php84-pdo \
    php84-pdo_sqlite \
    php84-dom \
    php84-fileinfo \
    php84-curl \
    php84-session \
    php84-simplexml \
    php84-iconv \
    php84-posix \
    php84-pcntl \
    php84-bcmath \
    && ln -sf /usr/bin/php84 /usr/bin/php

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

RUN apk add --no-cache \
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
