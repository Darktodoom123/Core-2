<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_job_delays', function (Blueprint $table): void {
            $table->id();
            $table->string('workspace_key', 32)->default('operations');
            $table->foreignId('dispatch_job_id')->constrained('dispatch_jobs')->cascadeOnDelete();
            $table->foreignId('dispatch_execution_attempt_id')->nullable()->constrained('dispatch_execution_attempts')->nullOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->foreignId('reported_by')->constrained('users')->restrictOnDelete();
            $table->string('context', 24); // 'transit' or 'on_site'
            $table->string('reason', 64);
            $table->string('reason_label', 128);
            $table->unsignedSmallInteger('estimated_minutes')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('job_version')->default(1);
            $table->timestamp('reported_at');
            $table->uuid('command_id')->nullable()->unique();
            $table->timestamps();

            $table->index('dispatch_job_id');
            $table->index('reported_by');
            $table->index('operational_asset_id');
            $table->index('context');
            $table->index('reported_at');
            $table->index('created_at');
            $table->index('workspace_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_job_delays');
    }
};
