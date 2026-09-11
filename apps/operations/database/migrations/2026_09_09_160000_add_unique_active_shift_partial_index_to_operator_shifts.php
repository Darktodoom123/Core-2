<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if (in_array($driver, ['sqlite', 'pgsql'], true)) {
            // Clean up any historical duplicate active/on_break shifts per user by completing older ones
            DB::statement("
                UPDATE operator_shifts
                SET status = 'completed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
                WHERE status IN ('active', 'on_break')
                  AND id NOT IN (
                      SELECT MAX(id)
                      FROM operator_shifts
                      WHERE status IN ('active', 'on_break')
                      GROUP BY user_id
                  )
            ");

            DB::statement("CREATE UNIQUE INDEX IF NOT EXISTS unique_active_operator_shift ON operator_shifts (user_id) WHERE status IN ('active', 'on_break')");
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if (in_array($driver, ['sqlite', 'pgsql'], true)) {
            DB::statement('DROP INDEX IF EXISTS unique_active_operator_shift');
        }
    }
};
