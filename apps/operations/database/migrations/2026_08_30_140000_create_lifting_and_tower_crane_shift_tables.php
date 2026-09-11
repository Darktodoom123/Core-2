<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('critical_lift_plans', function (Blueprint $table): void {
            $table->decimal('net_load_weight_tons', 8, 2)->nullable()->after('gross_load_weight_tons');
            $table->decimal('rigging_weight_tons', 8, 2)->default(0)->after('net_load_weight_tons');
            $table->decimal('hook_block_weight_tons', 8, 2)->default(0)->after('rigging_weight_tons');
            $table->decimal('load_moment_ton_meters', 10, 2)->nullable()->after('working_radius_meters');
        });

        Schema::create('tower_crane_shift_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->foreignId('operational_asset_id')->constrained('operational_assets')->cascadeOnDelete();
            $table->foreignId('operator_id')->constrained('users')->cascadeOnDelete();
            $table->date('shift_date');
            $table->string('shift_type', 32)->default('day');
            $table->boolean('pre_climb_passed')->default(false);
            $table->boolean('pre_climb_harness_inspected')->default(false);
            $table->boolean('pre_climb_ladder_cleared')->default(false);
            $table->boolean('anemometer_verified')->default(false);
            $table->decimal('operating_hours', 5, 2)->default(0);
            $table->unsignedInteger('lift_count')->default(0);
            $table->boolean('free_slew_engaged')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['operational_asset_id', 'shift_date']);
            $table->index(['dispatch_job_id', 'shift_date']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table personnel_credentials drop constraint if exists personnel_credentials_kind_check');
            DB::statement("alter table personnel_credentials add constraint personnel_credentials_kind_check check (kind in ('driver_license', 'operator_certification', 'rigger_certification', 'qualification'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tower_crane_shift_logs');

        Schema::table('critical_lift_plans', function (Blueprint $table): void {
            $table->dropColumn([
                'net_load_weight_tons',
                'rigging_weight_tons',
                'hook_block_weight_tons',
                'load_moment_ton_meters',
            ]);
        });
    }
};
