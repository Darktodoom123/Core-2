<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dispatch_job_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->text('work_summary');
            $table->text('remarks')->nullable();
            $table->string('status', 24)->default('draft')->index();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->index(['dispatch_job_id', 'status']);
        });

        Schema::create('attachments', function (Blueprint $table): void {
            $table->id();
            $table->morphs('owner');
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('kind', 32)->default('document')->index();
            $table->string('disk', 32)->default('local');
            $table->string('path')->unique();
            $table->string('original_filename');
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('size_bytes');
            $table->string('checksum_sha256', 64);
            $table->timestamp('retention_until')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->foreignId('dispatch_job_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('unread')->index();
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['dispatch_job_id', 'created_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table job_reports add constraint job_reports_status_check check (status in ('draft', 'submitted', 'approved', 'rejected'))");
            DB::statement('alter table job_reports add constraint job_reports_time_check check (ended_at is null or started_at is null or ended_at >= started_at)');
            DB::statement('alter table attachments add constraint attachments_size_check check (size_bytes > 0)');
            DB::statement("alter table notifications add constraint notifications_status_check check (status in ('unread', 'read', 'archived'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('job_reports');
    }
};
