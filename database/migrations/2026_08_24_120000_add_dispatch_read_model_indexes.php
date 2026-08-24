<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Concurrent index creation is not compatible with a migration transaction. */
    public $withinTransaction = false;

    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS dispatch_personnel_user_active_job_read_index ON dispatch_personnel_assignments (user_id, active_until, dispatch_job_id)');
            DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS dispatch_asset_asset_active_job_read_index ON dispatch_asset_assignments (operational_asset_id, active_until, dispatch_job_id)');
            DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS maintenance_dispatch_blocking_asset_read_index ON maintenance_work_orders (operational_asset_id) WHERE dispatch_blocking = true AND released_at IS NULL');
            DB::statement("CREATE INDEX CONCURRENTLY IF NOT EXISTS inspections_passing_asset_read_index ON inspections (operational_asset_id) WHERE result = 'passed' AND completed_at IS NOT NULL");
            DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS approval_subject_kind_latest_read_index ON approval_requests (subject_type, subject_id, kind, id DESC)');

            return;
        }

        Schema::table('dispatch_personnel_assignments', function (Blueprint $table): void {
            $table->index(['user_id', 'active_until', 'dispatch_job_id'], 'dispatch_personnel_user_active_job_read_index');
        });
        Schema::table('dispatch_asset_assignments', function (Blueprint $table): void {
            $table->index(['operational_asset_id', 'active_until', 'dispatch_job_id'], 'dispatch_asset_asset_active_job_read_index');
        });
        Schema::table('maintenance_work_orders', function (Blueprint $table): void {
            $table->index(['operational_asset_id', 'dispatch_blocking', 'released_at'], 'maintenance_dispatch_blocking_asset_read_index');
        });
        Schema::table('inspections', function (Blueprint $table): void {
            $table->index(['operational_asset_id', 'result', 'completed_at'], 'inspections_passing_asset_read_index');
        });
        Schema::table('approval_requests', function (Blueprint $table): void {
            $table->index(['subject_type', 'subject_id', 'kind', 'id'], 'approval_subject_kind_latest_read_index');
        });
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS dispatch_personnel_user_active_job_read_index');
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS dispatch_asset_asset_active_job_read_index');
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS maintenance_dispatch_blocking_asset_read_index');
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS inspections_passing_asset_read_index');
            DB::statement('DROP INDEX CONCURRENTLY IF EXISTS approval_subject_kind_latest_read_index');

            return;
        }

        Schema::table('approval_requests', fn (Blueprint $table): mixed => $table->dropIndex('approval_subject_kind_latest_read_index'));
        Schema::table('inspections', fn (Blueprint $table): mixed => $table->dropIndex('inspections_passing_asset_read_index'));
        Schema::table('maintenance_work_orders', fn (Blueprint $table): mixed => $table->dropIndex('maintenance_dispatch_blocking_asset_read_index'));
        Schema::table('dispatch_asset_assignments', fn (Blueprint $table): mixed => $table->dropIndex('dispatch_asset_asset_active_job_read_index'));
        Schema::table('dispatch_personnel_assignments', fn (Blueprint $table): mixed => $table->dropIndex('dispatch_personnel_user_active_job_read_index'));
    }
};
