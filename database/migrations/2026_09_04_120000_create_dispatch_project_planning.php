<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_project_plans', function (Blueprint $table) {
            $table->id();
            $table->string('source_reference', 150)->unique();
            $table->string('name');
            $table->string('client');
            $table->string('site');
            $table->string('status', 24)->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('approved_version')->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('submitted_by')->nullable()->constrained('users');
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->timestamp('approved_at')->nullable();
            $table->text('decision_reason')->nullable();
            $table->timestamps();
        });
        Schema::create('dispatch_project_phases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_plan_id')->constrained('dispatch_project_plans')->cascadeOnDelete();
            $table->string('name');
            $table->string('kind', 24);
            $table->timestamp('starts_at')->index();
            $table->timestamp('ends_at');
            $table->json('coverage');
            $table->timestamps();
        });
        Schema::create('dispatch_project_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_phase_id')->constrained('dispatch_project_phases')->cascadeOnDelete();
            $table->foreignId('operational_asset_id')->constrained('operational_assets');
            $table->string('kind', 24);
            $table->timestamp('starts_at')->index();
            $table->timestamp('ends_at');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['operational_asset_id', 'starts_at', 'ends_at'], 'project_asset_window');
        });
        Schema::create('dispatch_project_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_phase_id')->constrained('dispatch_project_phases');
            $table->foreignId('dispatch_job_id')->unique()->constrained('dispatch_jobs');
            $table->unsignedInteger('version')->default(1);
            $table->json('pending_roster')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users');
            $table->text('reason')->nullable();
            $table->unsignedInteger('confirmed_plan_version')->nullable();
            $table->timestamps();
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            // Planning is accessed through Laravel authorization, never the public data API.
            foreach (['dispatch_project_plans', 'dispatch_project_phases', 'dispatch_project_allocations', 'dispatch_project_shifts'] as $table) {
                DB::statement('alter table public."'.$table.'" enable row level security');
                foreach (['anon', 'authenticated'] as $role) {
                    if (DB::selectOne('select 1 from pg_roles where rolname = ?', [$role]) !== null) {
                        DB::statement('revoke all privileges on table public."'.$table.'" from "'.$role.'"');
                        DB::statement('revoke all privileges on sequence public."'.$table.'_id_seq" from "'.$role.'"');
                    }
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_project_shifts');
        Schema::dropIfExists('dispatch_project_allocations');
        Schema::dropIfExists('dispatch_project_phases');
        Schema::dropIfExists('dispatch_project_plans');
    }
};
