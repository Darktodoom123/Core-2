<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_handoffs', function (Blueprint $table): void {
            $table->id();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('source_type', 64);
            $table->unsignedBigInteger('source_id');
            $table->string('source_reference', 128);
            $table->foreignId('legacy_dispatch_job_id')->unique()->constrained('dispatch_jobs')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('compatibility_state', 64)->default('legacy_pending_reconciliation')->index();
            $table->json('legacy_snapshot')->nullable();
            $table->timestamps();
            $table->unique(['source_type', 'source_id']);
        });

        Schema::create('dispatch_execution_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('handoff_id')->constrained('dispatch_handoffs')->restrictOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->foreignId('replaces_attempt_id')->nullable()->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('legacy_dispatch_job_id')->nullable()->unique()->constrained('dispatch_jobs')->restrictOnDelete();
            $table->string('status', 24)->default('draft')->index();
            $table->string('legacy_status', 32)->nullable();
            $table->string('compatibility_state', 64)->default('legacy_pending_reconciliation')->index();
            $table->timestamp('scheduled_start')->nullable();
            $table->timestamp('scheduled_end')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->json('legacy_snapshot')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('activated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('cancellation_reason')->nullable();
            $table->timestamp('legacy_deleted_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();
            $table->unique(['handoff_id', 'attempt_number']);
            $table->index(['handoff_id', 'status']);
        });

        Schema::create('dispatch_plan_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->unsignedInteger('version');
            $table->string('status', 24)->default('draft')->index();
            $table->json('snapshot');
            $table->char('content_hash', 64);
            $table->timestamp('scheduled_start')->nullable();
            $table->timestamp('scheduled_end')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('sealed_at')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['attempt_id', 'version']);
            $table->index(['attempt_id', 'status']);
        });

        Schema::create('dispatch_plan_approvals', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('plan_version_id')->constrained('dispatch_plan_versions')->restrictOnDelete();
            $table->foreignId('approval_request_id')->nullable()->unique()->constrained('approval_requests')->restrictOnDelete();
            $table->string('kind', 64);
            $table->string('status', 24)->default('pending')->index();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->index(['plan_version_id', 'status']);
            $table->index(['plan_version_id', 'kind']);
        });

        Schema::create('dispatch_assignment_offers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('plan_version_id')->constrained('dispatch_plan_versions')->restrictOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('legacy_assignment_id')->nullable()->unique()->constrained('dispatch_personnel_assignments')->restrictOnDelete();
            $table->string('assignment_type', 32);
            $table->boolean('is_mandatory')->default(false);
            $table->string('status', 24)->default('proposed')->index();
            $table->timestamp('offered_at')->nullable();
            $table->timestamp('response_deadline')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->text('response_reason')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('withdrawn_at')->nullable();
            $table->timestamp('expired_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('legacy_response_status', 24)->nullable();
            $table->string('compatibility_state', 64)->default('legacy_pending_reconciliation')->index();
            $table->timestamps();
            $table->index(['attempt_id', 'status']);
            $table->index(['plan_version_id', 'status']);
        });

        Schema::table('dispatch_execution_attempts', function (Blueprint $table): void {
            $table->foreignId('designated_lead_offer_id')->nullable()->constrained('dispatch_assignment_offers')->restrictOnDelete();
            $table->foreignId('lead_designated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('lead_designated_at')->nullable();
            $table->text('lead_designation_reason')->nullable();
        });

        Schema::create('dispatch_idempotency_keys', function (Blueprint $table): void {
            $table->id();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('owner_type', 64);
            $table->unsignedBigInteger('owner_id');
            $table->string('idempotency_key', 128);
            $table->string('action_name', 128);
            $table->char('payload_hash', 64)->nullable();
            $table->unsignedInteger('expected_version')->nullable();
            $table->string('status', 24)->default('claimed')->index();
            $table->unsignedSmallInteger('response_code')->nullable();
            $table->json('response_payload')->nullable();
            $table->foreignId('attempt_id')->nullable()->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('legacy_command_log_id')->nullable()->unique()->constrained('command_logs')->restrictOnDelete();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['workspace_key', 'owner_type', 'owner_id', 'idempotency_key'], 'dispatch_idempotency_owner_key_unique');
            $table->index(['owner_type', 'owner_id']);
            $table->index(['attempt_id', 'status']);
        });

        Schema::create('dispatch_audit_lineage', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('audit_event_id')->unique()->constrained('audit_events')->restrictOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->foreignId('handoff_id')->nullable()->constrained('dispatch_handoffs')->restrictOnDelete();
            $table->foreignId('attempt_id')->nullable()->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('plan_version_id')->nullable()->constrained('dispatch_plan_versions')->restrictOnDelete();
            $table->foreignId('offer_id')->nullable()->constrained('dispatch_assignment_offers')->restrictOnDelete();
            $table->foreignId('idempotency_key_id')->nullable()->constrained('dispatch_idempotency_keys')->restrictOnDelete();
            $table->string('lineage_type', 32);
            $table->string('legacy_subject_type', 128)->nullable();
            $table->unsignedBigInteger('legacy_subject_id')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['handoff_id', 'attempt_id']);
            $table->index(['legacy_subject_type', 'legacy_subject_id']);
        });

        Schema::create('dispatch_reconciliation_runs', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 96)->default('dispatch_v2_foundation');
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('status', 24)->default('running')->index();
            $table->boolean('dry_run')->default(false);
            $table->unsignedInteger('batch_limit')->default(100);
            $table->json('checkpoint')->nullable();
            $table->unsignedInteger('scanned_count')->default(0);
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('updated_count')->default(0);
            $table->unsignedInteger('finding_count')->default(0);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
        });

        Schema::create('dispatch_reconciliation_findings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('run_id')->nullable()->constrained('dispatch_reconciliation_runs')->nullOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('entity_type', 96);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('code', 64)->index();
            $table->string('severity', 16)->default('blocker')->index();
            $table->json('details')->nullable();
            $table->char('fingerprint', 64)->unique();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['entity_type', 'entity_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table dispatch_execution_attempts add constraint dispatch_attempts_status_check check (status in ('draft', 'dispatched', 'en_route', 'arrived', 'working', 'completed', 'cancelled'))");
            DB::statement('alter table dispatch_execution_attempts add constraint dispatch_attempts_version_check check (version > 0)');
            DB::statement('alter table dispatch_execution_attempts add constraint dispatch_attempts_schedule_check check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start)');
            DB::statement("alter table dispatch_plan_versions add constraint dispatch_plan_versions_status_check check (status in ('draft', 'submitted', 'approved', 'rejected', 'superseded'))");
            DB::statement('alter table dispatch_plan_versions add constraint dispatch_plan_versions_schedule_check check (scheduled_end is null or scheduled_start is null or scheduled_end > scheduled_start)');
            DB::statement("alter table dispatch_assignment_offers add constraint dispatch_offers_status_check check (status in ('proposed', 'offered', 'accepted', 'rejected', 'withdrawn', 'expired'))");
            DB::statement("alter table dispatch_plan_approvals add constraint dispatch_plan_approvals_status_check check (status in ('pending', 'approved', 'rejected', 'superseded'))");
            DB::statement("alter table dispatch_reconciliation_runs add constraint dispatch_reconciliation_runs_status_check check (status in ('running', 'completed', 'failed'))");
            DB::statement("alter table dispatch_reconciliation_findings add constraint dispatch_reconciliation_findings_severity_check check (severity in ('warning', 'blocker'))");
        }
    }

    public function down(): void
    {
        Schema::table('dispatch_execution_attempts', function (Blueprint $table): void {
            $table->dropForeign(['designated_lead_offer_id']);
            $table->dropForeign(['lead_designated_by']);
            $table->dropColumn(['designated_lead_offer_id', 'lead_designated_by', 'lead_designated_at', 'lead_designation_reason']);
        });

        Schema::dropIfExists('dispatch_reconciliation_findings');
        Schema::dropIfExists('dispatch_reconciliation_runs');
        Schema::dropIfExists('dispatch_audit_lineage');
        Schema::dropIfExists('dispatch_idempotency_keys');
        Schema::dropIfExists('dispatch_assignment_offers');
        Schema::dropIfExists('dispatch_plan_approvals');
        Schema::dropIfExists('dispatch_plan_versions');
        Schema::dropIfExists('dispatch_execution_attempts');
        Schema::dropIfExists('dispatch_handoffs');
    }
};
