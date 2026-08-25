#!/bin/sh
set -eu

umask 0007

fail() {
    echo "[core2] $*" >&2
    exit 1
}

require_env() {
    variable_name=$1
    eval "variable_value=\${$variable_name:-}"
    if [ -z "$variable_value" ]; then
        fail "$variable_name must be provided through the container environment."
    fi
}

require_env APP_KEY
require_env DB_CONNECTION

case "$DB_CONNECTION" in
    sqlite)
        ;;
    pgsql|mysql|mariadb|sqlsrv)
        require_env DB_HOST
        require_env DB_DATABASE
        require_env DB_USERNAME
        require_env DB_PASSWORD
        ;;
    *)
        fail "Unsupported DB_CONNECTION: $DB_CONNECTION"
        ;;
esac

if [ "${BROADCAST_CONNECTION:-null}" = "reverb" ]; then
    require_env REVERB_APP_ID
    require_env REVERB_APP_KEY
    require_env REVERB_APP_SECRET
fi

case "${CACHE_STORE:-file}:${QUEUE_CONNECTION:-sync}:${SESSION_DRIVER:-file}" in
    *redis*)
        require_env REDIS_HOST
        require_env REDIS_PORT
        ;;
esac

run_as_app() {
    su-exec www-data "$@"
}

mkdir -p /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache \
         /var/www/html/database

if [ "$DB_CONNECTION" = "sqlite" ]; then
    sqlite_database=${DB_DATABASE:-/var/www/html/database/database.sqlite}
    if [ "$sqlite_database" != ":memory:" ]; then
        mkdir -p "$(dirname "$sqlite_database")"
        touch "$sqlite_database"
    fi
fi

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
find /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database -type d -exec chmod 0770 {} \;
find /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database -type f -exec chmod 0660 {} \;

case "${RUN_MIGRATIONS:-true}" in
    true)
        echo "[core2] Running database migrations..."
        run_as_app php artisan migrate --force --no-interaction
        ;;
    false)
        echo "[core2] Database migrations are disabled (RUN_MIGRATIONS=false)."
        ;;
    *)
        fail "RUN_MIGRATIONS must be true or false."
        ;;
esac

if [ "${APP_ENV:-production}" = "production" ]; then
    case "${CACHE_CONFIG:-true}" in
        true)
            echo "[core2] Caching configuration, routes, and views..."
            run_as_app php artisan config:cache
            run_as_app php artisan route:cache
            run_as_app php artisan view:cache
            ;;
        false)
            echo "[core2] Laravel config/route/view caching is disabled (CACHE_CONFIG=false)."
            ;;
        *)
            fail "CACHE_CONFIG must be true or false."
            ;;
    esac
fi

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
find /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database -type d -exec chmod 0770 {} \;
find /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database -type f -exec chmod 0660 {} \;

exec "$@"
