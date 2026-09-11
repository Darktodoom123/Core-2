<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->foreignId('service_request_id')->nullable()->constrained()->nullOnDelete();
            $table->index(['service_request_id', 'status']);
        });

        Schema::table('operational_assets', function (Blueprint $table): void {
            $table->string('registration_number', 64)->nullable()->unique();
            $table->string('manufacturer')->nullable();
            $table->string('model')->nullable();
            $table->decimal('rated_capacity', 12, 2)->nullable();
            $table->string('capacity_unit', 24)->nullable();
            $table->string('meter_type', 24)->nullable();
            $table->decimal('meter_value', 14, 2)->nullable();
            $table->index(['kind', 'status']);
        });

        Schema::table('location_updates', function (Blueprint $table): void {
            $table->foreignId('dispatch_job_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('speed', 8, 2)->nullable();
            $table->text('remarks')->nullable();
            $table->index(['dispatch_job_id', 'captured_at']);
        });

        Schema::table('fuel_logs', function (Blueprint $table): void {
            $table->decimal('price_per_litre', 12, 2)->nullable();
            $table->decimal('total_cost', 14, 2)->nullable();
            $table->string('fuel_station')->nullable();
            $table->text('remarks')->nullable();
        });

        Schema::table('maintenance_work_orders', function (Blueprint $table): void {
            $table->timestamp('scheduled_at')->nullable()->index();
            $table->timestamp('next_due_at')->nullable()->index();
            $table->text('remarks')->nullable();
            $table->foreignId('release_verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('release_checklist')->nullable();
        });

        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->text('prompt_summary')->nullable();
            $table->text('response_summary')->nullable();
            $table->json('usage')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table operational_assets add constraint operational_assets_rated_capacity_check check (rated_capacity is null or rated_capacity > 0)');
            DB::statement('alter table operational_assets add constraint operational_assets_meter_value_check check (meter_value is null or meter_value >= 0)');
            DB::statement('alter table location_updates add constraint location_updates_speed_check check (speed is null or speed >= 0)');
            DB::statement('alter table fuel_logs add constraint fuel_logs_price_check check (price_per_litre is null or price_per_litre >= 0)');
            DB::statement('alter table fuel_logs add constraint fuel_logs_total_cost_check check (total_cost is null or total_cost >= 0)');
        }
    }

    public function down(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->dropColumn(['prompt_summary', 'response_summary', 'usage', 'expires_at']);
        });

        Schema::table('maintenance_work_orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('release_verified_by');
            $table->dropColumn(['scheduled_at', 'next_due_at', 'remarks', 'release_checklist']);
        });

        Schema::table('fuel_logs', function (Blueprint $table): void {
            $table->dropColumn(['price_per_litre', 'total_cost', 'fuel_station', 'remarks']);
        });

        Schema::table('location_updates', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('dispatch_job_id');
            $table->dropColumn(['speed', 'remarks']);
        });

        Schema::table('operational_assets', function (Blueprint $table): void {
            $table->dropColumn(['registration_number', 'manufacturer', 'model', 'rated_capacity', 'capacity_unit', 'meter_type', 'meter_value']);
        });

        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('service_request_id');
        });
    }
};
