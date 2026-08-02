# ==========================================
# Stage 1: Build Frontend Assets
# ==========================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_REVERB_APP_KEY
ARG VITE_REVERB_HOST=localhost
ARG VITE_REVERB_PORT=8080
ARG VITE_REVERB_SCHEME=http

ENV VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY} \
    VITE_REVERB_HOST=${VITE_REVERB_HOST} \
    VITE_REVERB_PORT=${VITE_REVERB_PORT} \
    VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME}

RUN npm run build

# ==========================================
# Stage 2: Install Composer Dependencies
# ==========================================
FROM composer:2 AS composer-builder
WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

# ==========================================
# Stage 3: Production Runtime
# ==========================================
FROM php:8.3-fpm-alpine AS runtime

# Install system dependencies & runtime utilities
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

# Configure & install PHP extensions
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

# Copy configuration files
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy application source code
COPY --chown=www-data:www-data . .

# Copy vendor from composer-builder & built assets from frontend-builder
COPY --from=composer-builder --chown=www-data:www-data /app/vendor ./vendor
COPY --from=frontend-builder --chown=www-data:www-data /app/public/build ./public/build

# Rebuild package discovery from the production dependency set. This avoids
# copying stale host cache files that reference development-only providers.
RUN rm -f bootstrap/cache/*.php \
    && php artisan package:discover --ansi

# Set permissions for storage & bootstrap cache
RUN mkdir -p storage bootstrap/cache database \
    && chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 80 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
