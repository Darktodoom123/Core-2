<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operator_duty_logs', function (Blueprint $table): void {
            $table->string('previous_duty_status', 32)->nullable()->index();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->timestamp('occurred_at')->nullable()->index();
            $table->timestamp('accepted_at')->nullable()->index();
            $table->decimal('accuracy_metres', 8, 2)->nullable();
            $table->timestamp('location_observed_at')->nullable();
            $table->string('location_source', 40)->nullable();
            $table->string('location_freshness', 24)->nullable()->index();
        });

        // Preserve the meaning of records written before the event snapshot
        // fields existed. They remain auditable without inventing a fresh GPS
        // observation.
        DB::table('operator_duty_logs')->whereNull('occurred_at')->update([
            'occurred_at' => DB::raw('started_at'),
        ]);
        DB::table('operator_duty_logs')->whereNull('accepted_at')->update([
            'accepted_at' => DB::raw('created_at'),
        ]);
        DB::table('operator_duty_logs')
            ->whereNull('location_source')
            ->where(function ($query): void {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update(['location_source' => 'legacy']);
        DB::table('operator_duty_logs')
            ->whereNull('location_source')
            ->update(['location_source' => 'unavailable']);
        DB::table('operator_duty_logs')
            ->whereNull('location_freshness')
            ->where(function ($query): void {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update(['location_freshness' => 'last_known']);
        DB::table('operator_duty_logs')
            ->whereNull('location_freshness')
            ->update(['location_freshness' => 'unavailable']);

        // Existing shifts already own the equipment context. Backfill it on
        // each event so estimated usage can remain interval-specific.
        DB::statement(<<<'SQL'
            UPDATE operator_duty_logs
            SET operational_asset_id = (
                SELECT operational_asset_id
                FROM operator_shifts
                WHERE operator_shifts.id = operator_duty_logs.operator_shift_id
            ),
            dispatch_job_id = (
                SELECT dispatch_job_id
                FROM operator_shifts
                WHERE operator_shifts.id = operator_duty_logs.operator_shift_id
            )
            WHERE operational_asset_id IS NULL OR dispatch_job_id IS NULL
        SQL);

        $driver = DB::getDriverName();

        if (in_array($driver, ['sqlite', 'pgsql'], true)) {
            // A historical duplicate open interval must not prevent the
            // invariant from being installed. Keep the newest event open and
            // close older duplicates at their recorded start.
            DB::statement("\n                UPDATE operator_duty_logs\n                SET ended_at = COALESCE(ended_at, started_at),\n                    duration_minutes = COALESCE(duration_minutes, 0)\n                WHERE ended_at IS NULL\n                  AND id NOT IN (\n                      SELECT MAX(id)\n                      FROM operator_duty_logs\n                      WHERE ended_at IS NULL\n                      GROUP BY operator_shift_id\n                  )\n            ");

            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS unique_open_operator_duty_log ON operator_duty_logs (operator_shift_id) WHERE ended_at IS NULL');
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if (in_array($driver, ['sqlite', 'pgsql'], true)) {
            DB::statement('DROP INDEX IF EXISTS unique_open_operator_duty_log');
        }

        Schema::table('operator_duty_logs', function (Blueprint $table): void {
            $table->dropForeign(['operational_asset_id']);
            $table->dropForeign(['dispatch_job_id']);
            $table->dropColumn([
                'previous_duty_status',
                'operational_asset_id',
                'dispatch_job_id',
                'occurred_at',
                'accepted_at',
                'accuracy_metres',
                'location_observed_at',
                'location_source',
                'location_freshness',
            ]);
        });
    }
};
