<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('operational_assets', function (Blueprint $table): void {
            $table->decimal('baseline_burn_rate', 8, 2)->nullable();
            $table->string('burn_rate_unit', 16)->nullable();
        });

        Schema::table('fuel_logs', function (Blueprint $table): void {
            $table->decimal('variance_litres', 10, 2)->nullable();
            $table->decimal('variance_percentage', 6, 2)->nullable();
            $table->decimal('effective_burn_rate', 8, 2)->nullable();
            $table->string('burn_rate_unit', 16)->nullable();
            $table->boolean('is_anomaly')->default(false)->index();
            $table->text('anomaly_reason')->nullable();
            $table->index(['is_anomaly', 'recorded_at']);
            $table->index(['recorded_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table operational_assets add constraint operational_assets_baseline_burn_rate_check check (baseline_burn_rate is null or baseline_burn_rate >= 0)');
            DB::statement('alter table fuel_logs add constraint fuel_logs_effective_burn_rate_check check (effective_burn_rate is null or effective_burn_rate >= 0)');
        }
    }

    public function down(): void
    {
        Schema::table('fuel_logs', function (Blueprint $table): void {
            $table->dropIndex(['is_anomaly', 'recorded_at']);
            $table->dropIndex(['recorded_at']);
            $table->dropColumn([
                'variance_litres',
                'variance_percentage',
                'effective_burn_rate',
                'burn_rate_unit',
                'is_anomaly',
                'anomaly_reason',
            ]);
        });

        Schema::table('operational_assets', function (Blueprint $table): void {
            $table->dropColumn([
                'baseline_burn_rate',
                'burn_rate_unit',
            ]);
        });
    }
};
