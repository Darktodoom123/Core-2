<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var list<string> */
    private array $tables = [
        'migrations',
        'users',
        'password_reset_tokens',
        'sessions',
        'cache',
        'cache_locks',
        'jobs',
        'job_batches',
        'failed_jobs',
        'permissions',
        'roles',
        'model_has_permissions',
        'model_has_roles',
        'role_has_permissions',
        'clients',
        'service_requests',
        'personnel_profiles',
        'personnel_credentials',
        'operational_assets',
        'dispatch_jobs',
        'dispatch_personnel_assignments',
        'dispatch_asset_assignments',
        'approval_requests',
        'audit_events',
        'inspections',
        'maintenance_work_orders',
        'fuel_requests',
        'fuel_logs',
        'location_updates',
        'gpt_recommendations',
        'job_reports',
        'attachments',
        'notifications',
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables as $table) {
            DB::statement(sprintf('alter table public.%s enable row level security', $table));
        }

        foreach (['anon', 'authenticated'] as $role) {
            $exists = DB::selectOne('select count(*) as aggregate from pg_roles where rolname = ?', [$role]);

            if ((int) ($exists->aggregate ?? 0) === 0) {
                continue;
            }

            foreach ($this->tables as $table) {
                DB::statement(sprintf('revoke all privileges on table public.%s from %s', $table, $role));
            }

            DB::statement(sprintf('revoke usage, select on all sequences in schema public from %s', $role));
            DB::statement(sprintf('alter default privileges in schema public revoke select, insert, update, delete on tables from %s', $role));
            DB::statement(sprintf('alter default privileges in schema public revoke usage, select on sequences from %s', $role));
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables as $table) {
            DB::statement(sprintf('alter table public.%s disable row level security', $table));
        }

        // Revoked Data API privileges remain revoked intentionally; restoring broad
        // access automatically would make a rollback less secure than the migration.
    }
};
