<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('operational_assets', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('kind', 32)->index();
            $table->string('subtype')->nullable();
            $table->string('status', 32)->index();
            $table->string('location')->nullable();
            $table->json('specifications')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('dispatch_jobs', function (Blueprint $table): void {
            $table->id();
            $table->string('reference')->unique();
            $table->string('client');
            $table->string('title');
            $table->text('site');
            $table->text('site_notes')->nullable();
            $table->timestamp('scheduled_start')->nullable()->index();
            $table->timestamp('scheduled_end')->nullable();
            $table->string('priority', 24)->index();
            $table->string('status', 32)->index();
            $table->json('requirements')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('dispatch_personnel_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dispatch_job_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('assignment_type', 32)->index();
            $table->string('response_status', 24)->default('pending')->index();
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('active_from')->nullable();
            $table->timestamp('active_until')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'active_until']);
        });

        Schema::create('dispatch_asset_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dispatch_job_id')->constrained()->cascadeOnDelete();
            $table->foreignId('operational_asset_id')->constrained()->restrictOnDelete();
            $table->string('assignment_type', 32)->index();
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('active_from')->nullable();
            $table->timestamp('active_until')->nullable();
            $table->timestamps();
            $table->index(['operational_asset_id', 'active_until']);
        });

        Schema::create('approval_requests', function (Blueprint $table): void {
            $table->id();
            $table->morphs('subject');
            $table->string('kind', 48)->index();
            $table->json('requested_changes')->nullable();
            $table->string('status', 24)->default('pending')->index();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->nullableMorphs('subject');
            $table->string('action', 96)->index();
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->text('reason')->nullable();
            $table->uuid('request_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('approval_requests');
        Schema::dropIfExists('dispatch_asset_assignments');
        Schema::dropIfExists('dispatch_personnel_assignments');
        Schema::dropIfExists('dispatch_jobs');
        Schema::dropIfExists('operational_assets');
    }
};
