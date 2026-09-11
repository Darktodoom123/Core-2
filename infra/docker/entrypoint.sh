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

require_positive_integer() {
    variable_name=$1
    eval "variable_value=\${$variable_name:-}"
    case "$variable_value" in
        ''|*[!0-9]*)
            fail "$variable_name must be a positive integer."
            ;;
        0)
            fail "$variable_name must be greater than zero."
            ;;
    esac
}

DB_WAIT_TIMEOUT_SECONDS=${DB_WAIT_TIMEOUT_SECONDS:-60}
DB_WAIT_INTERVAL_SECONDS=${DB_WAIT_INTERVAL_SECONDS:-2}
DB_WAIT_PROBE_TIMEOUT_SECONDS=${DB_WAIT_PROBE_TIMEOUT_SECONDS:-5}
MIGRATION_TIMEOUT_SECONDS=${MIGRATION_TIMEOUT_SECONDS:-120}

require_positive_integer DB_WAIT_TIMEOUT_SECONDS
require_positive_integer DB_WAIT_INTERVAL_SECONDS
require_positive_integer DB_WAIT_PROBE_TIMEOUT_SECONDS
require_positive_integer MIGRATION_TIMEOUT_SECONDS

require_env APP_KEY
require_env DB_CONNECTION

service_name=${CORE2_SERVICE_NAME:-operations}
case "$service_name" in
    operations|tracking)
        ;;
    *)
        fail "Unsupported CORE2_SERVICE_NAME: $service_name"
        ;;
esac

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

if [ "$service_name" = "tracking" ]; then
    require_env TRACKING_SERVICE_SECRET
    if [ "${CACHE_STORE:-file}" != "file" ]; then
        fail "Tracking requires CACHE_STORE=file so scheduler locks use its persistent file cache."
    fi
elif [ "${TRACKING_SERVICE_DRIVER:-database}" = "http" ]; then
    require_env TRACKING_SERVICE_URL
    require_env TRACKING_SERVICE_SECRET
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

wait_for_database() {
    if [ "$DB_CONNECTION" = "sqlite" ]; then
        return 0
    fi

    deadline=$(( $(date +%s) + DB_WAIT_TIMEOUT_SECONDS ))
    while :; do
        now=$(date +%s)
        if [ "$now" -ge "$deadline" ]; then
            fail "Database was not reachable within ${DB_WAIT_TIMEOUT_SECONDS}s."
        fi

        remaining=$((deadline - now))
        probe_timeout=$DB_WAIT_PROBE_TIMEOUT_SECONDS
        if [ "$remaining" -lt "$probe_timeout" ]; then
            probe_timeout=$remaining
        fi

        if timeout "$probe_timeout" su-exec www-data php artisan db:show --database="$DB_CONNECTION" --silent --no-interaction >/dev/null 2>&1; then
            return 0
        fi

        if [ "$(date +%s)" -ge "$deadline" ]; then
            fail "Database was not reachable within ${DB_WAIT_TIMEOUT_SECONDS}s."
        fi

        sleep "$DB_WAIT_INTERVAL_SECONDS"
    done
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
        wait_for_database
        echo "[core2] Running database migrations..."
        if ! timeout "$MIGRATION_TIMEOUT_SECONDS" su-exec www-data php artisan migrate --force --no-interaction; then
            fail "Database migrations did not complete within ${MIGRATION_TIMEOUT_SECONDS}s."
        fi
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
            echo "[core2] Caching configuration and routes..."
            run_as_app php artisan config:cache
            run_as_app php artisan route:cache
            if [ "$service_name" = "operations" ]; then
                run_as_app php artisan view:cache
            fi
            ;;
        false)
            echo "[core2] Laravel config/route caching is disabled (CACHE_CONFIG=false)."
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
