#!/bin/sh
set -eu

: "${DB_HOST:?DB_HOST must be set for the concurrency test runner}"
: "${DB_PORT:?DB_PORT must be set for the concurrency test runner}"
: "${DB_USERNAME:?DB_USERNAME must be set for the concurrency test runner}"
: "${DB_PASSWORD:?DB_PASSWORD must be set for the concurrency test runner}"

test_database=core2_concurrency_test
admin_database="${DB_ADMIN_DATABASE:-postgres}"
export PGPASSWORD="$DB_PASSWORD"

until pg_isready \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USERNAME" \
    --dbname="$admin_database" >/dev/null 2>&1; do
    sleep 1
done

if ! psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USERNAME" \
    --dbname="$admin_database" \
    --tuples-only \
    --no-align \
    --command="SELECT 1 FROM pg_database WHERE datname = '$test_database'" | grep -q '^1$'; then
    psql \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USERNAME" \
        --dbname="$admin_database" \
        --command="CREATE DATABASE $test_database"
fi

export DB_DATABASE="$test_database"
# The profile owns this dedicated database. Recreate its schema so repeated
# runs cannot inherit random fixture rows or a previous test's cleanup state.
php artisan migrate:fresh --force --no-interaction

exec "$@"
