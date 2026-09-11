<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dvir_inspections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->string('inspection_type', 32)->index();
            $table->string('asset_code')->nullable();
            $table->string('asset_name')->nullable();
            $table->string('inspector_name')->nullable();
            $table->decimal('starting_odometer_km', 12, 2)->nullable();
            $table->decimal('ending_odometer_km', 12, 2)->nullable();
            $table->decimal('engine_hours', 12, 2)->nullable();
            $table->boolean('has_defects')->default(false)->index();
            $table->unsignedInteger('critical_defects_count')->default(0);
            $table->boolean('signature_captured')->default(false);
            $table->text('remarks')->nullable();
            $table->timestamp('completed_at')->index();
            $table->timestamps();

            $table->index(['user_id', 'completed_at']);
            $table->index(['operational_asset_id', 'completed_at']);
        });

        Schema::create('dvir_inspection_checks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dvir_inspection_id')->constrained('dvir_inspections')->cascadeOnDelete();
            $table->string('external_id', 64)->nullable();
            $table->string('category', 64)->index();
            $table->string('label');
            $table->string('status', 32)->index();
            $table->string('status_label')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['dvir_inspection_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dvir_inspection_checks');
        Schema::dropIfExists('dvir_inspections');
    }
};
