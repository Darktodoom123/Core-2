<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inspections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('operational_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('technician_id')->constrained('users')->restrictOnDelete();
            $table->string('type', 32);
            $table->string('result', 32)->index();
            $table->json('checklist');
            $table->text('findings')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('maintenance_work_orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('operational_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->index();
            $table->text('defect');
            $table->json('work_performed')->nullable();
            $table->json('parts')->nullable();
            $table->boolean('dispatch_blocking')->default(true)->index();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();
        });

        Schema::create('fuel_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('requester_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('quantity_litres', 10, 2);
            $table->string('fuel_type', 24);
            $table->text('purpose');
            $table->string('status', 24)->default('submitted')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('fuel_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('fuel_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->decimal('quantity_litres', 10, 2);
            $table->unsignedBigInteger('odometer_km')->nullable();
            $table->decimal('hour_meter', 12, 2)->nullable();
            $table->string('receipt_path')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fuel_logs');
        Schema::dropIfExists('fuel_requests');
        Schema::dropIfExists('maintenance_work_orders');
        Schema::dropIfExists('inspections');
    }
};
