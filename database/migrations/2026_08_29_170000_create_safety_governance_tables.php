<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('toolbox_meetings', function (Blueprint $table): void {
            $table->id();
            $table->string('project_site');
            $table->string('topic_id', 64);
            $table->string('topic_title');
            $table->string('topic_category', 64);
            $table->foreignId('conductor_id')->constrained('users')->cascadeOnDelete();
            $table->string('conductor_role', 64);
            $table->json('attendee_ids');
            $table->unsignedInteger('attendee_count');
            $table->text('photo_evidence_url')->nullable();
            $table->timestamp('photo_timestamp')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('safety_officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('safety_officer_signed_at')->nullable();
            $table->string('audit_hash')->nullable()->index();
            $table->timestamps();

            $table->index(['project_site', 'created_at']);
        });

        Schema::create('critical_lift_plans', function (Blueprint $table): void {
            $table->id();
            $table->string('lift_reference', 64)->unique();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->string('project_site');
            $table->foreignId('crane_operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('lead_rigger_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('rigger_tesda_nc_number', 64);
            $table->string('risk_level', 32)->default('critical');
            $table->decimal('gross_load_weight_tons', 8, 2);
            $table->decimal('crane_rated_capacity_tons', 8, 2);
            $table->decimal('load_percentage_of_capacity', 5, 2);
            $table->decimal('boom_length_meters', 8, 2);
            $table->decimal('working_radius_meters', 8, 2);
            $table->string('ground_bearing_condition');
            $table->decimal('weather_wind_speed_kph', 5, 2)->default(0);
            $table->string('status', 32)->default('pending_so_review')->index();
            $table->foreignId('foreman_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('foreman_signed_at')->nullable();
            $table->foreignId('safety_officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('safety_officer_signed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['project_site', 'status']);
        });

        Schema::create('site_hazard_tickets', function (Blueprint $table): void {
            $table->id();
            $table->string('ticket_code', 64)->unique();
            $table->string('project_site');
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('category', 64)->index();
            $table->string('severity', 32)->index();
            $table->text('description');
            $table->string('location_detail');
            $table->text('photo_evidence_url')->nullable();
            $table->text('corrective_action_required');
            $table->string('status', 32)->default('open')->index();
            $table->boolean('work_stoppage_issued')->default(false);
            $table->foreignId('rectified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rectified_at')->nullable();
            $table->timestamps();

            $table->index(['project_site', 'status']);
        });

        Schema::create('work_stoppage_notices', function (Blueprint $table): void {
            $table->id();
            $table->string('notice_number', 64)->unique();
            $table->string('project_site');
            $table->foreignId('safety_officer_id')->constrained('users')->cascadeOnDelete();
            $table->string('dole_regulation_reference', 128);
            $table->text('reason');
            $table->json('affected_asset_ids')->nullable();
            $table->string('affected_area');
            $table->boolean('is_active')->default(true)->index();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('lifted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('lifted_at')->nullable();
            $table->text('lift_reason')->nullable();
            $table->timestamps();

            $table->index(['project_site', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_stoppage_notices');
        Schema::dropIfExists('site_hazard_tickets');
        Schema::dropIfExists('critical_lift_plans');
        Schema::dropIfExists('toolbox_meetings');
    }
};
