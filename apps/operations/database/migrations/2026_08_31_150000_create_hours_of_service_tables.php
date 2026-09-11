<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operator_shifts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->string('status', 32)->default('active')->index();
            $table->timestamp('started_at')->index();
            $table->timestamp('ended_at')->nullable()->index();
            $table->unsignedInteger('operating_minutes')->default(0);
            $table->unsignedInteger('driving_minutes')->default(0);
            $table->unsignedInteger('standby_minutes')->default(0);
            $table->unsignedInteger('break_minutes')->default(0);
            $table->boolean('is_certified')->default(false)->index();
            $table->timestamp('certified_at')->nullable();
            $table->text('certification_statement')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status', 'started_at']);
        });

        Schema::create('operator_duty_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('operator_shift_id')->constrained('operator_shifts')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('duty_status', 32)->index();
            $table->string('standby_reason', 64)->nullable()->index();
            $table->boolean('is_demurrage_billable')->default(false)->index();
            $table->timestamp('started_at')->index();
            $table->timestamp('ended_at')->nullable()->index();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('location_name')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['operator_shift_id', 'started_at']);
            $table->index(['user_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operator_duty_logs');
        Schema::dropIfExists('operator_shifts');
    }
};
