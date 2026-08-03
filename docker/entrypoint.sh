#!/bin/sh
set -e

# Ensure .env exists
if [ ! -f /var/www/html/.env ]; then
    echo "Creating .env from .env.example..."
    cp /var/www/html/.env.example /var/www/html/.env
fi

# Ensure storage & cache directories exist and have proper permissions
mkdir -p /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache \
         /var/www/html/database

# Ensure SQLite file exists if using sqlite
if [ "${DB_CONNECTION}" = "sqlite" ] || [ -z "${DB_CONNECTION}" ]; then
    if [ ! -f /var/www/html/database/database.sqlite ]; then
        touch /var/www/html/database/database.sqlite
    fi
    chown -R www-data:www-data /var/www/html/database
fi

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

if [ -z "${APP_KEY:-}" ]; then
    echo "APP_KEY must be provided through the container environment." >&2
    exit 1
fi

# Execute migrations if configured
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "Running migrations..."
    php artisan migrate --force
fi

# Optimization for production
if [ "${APP_ENV:-production}" = "production" ]; then
    echo "Caching configuration and routes..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi

# Ensure storage and bootstrap cache are owned by www-data after setup
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache

exec "$@"
