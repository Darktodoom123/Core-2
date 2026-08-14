<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_assignment_offers', function (Blueprint $table): void {
            $table->timestamp('ended_at')->nullable()->after('expired_at');
            $table->foreignId('ended_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            $table->text('ended_reason')->nullable()->after('response_reason');
            $table->index(['attempt_id', 'plan_version_id', 'status'], 'dispatch_offer_attempt_plan_status_index');
        });

        Schema::table('dispatch_plan_approvals', function (Blueprint $table): void {
            $table->text('request_reason')->nullable()->after('requested_by');
            $table->index(['plan_version_id', 'status', 'requested_by'], 'dispatch_plan_approval_decision_index');
        });

        Schema::create('dispatch_plan_requirement_slots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('plan_version_id')->constrained('dispatch_plan_versions')->restrictOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('kind', 24);
            $table->string('slot_key', 96);
            $table->string('assignment_type', 32);
            $table->boolean('is_mandatory')->default(false);
            $table->foreignId('user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['plan_version_id', 'slot_key'], 'dispatch_plan_requirement_slot_unique');
            $table->index(['plan_version_id', 'kind', 'is_mandatory'], 'dispatch_plan_requirement_kind_index');
        });

        Schema::create('dispatch_emergency_overrides', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('attempt_id')->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('plan_version_id')->constrained('dispatch_plan_versions')->restrictOnDelete();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('kind', 48)->default('readiness_exception');
            $table->json('scope');
            $table->string('status', 24)->default('proposed')->index();
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('request_reason');
            $table->text('decision_reason')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->foreignId('idempotency_key_id')->nullable()->unique()->constrained('dispatch_idempotency_keys')->restrictOnDelete();
            $table->timestamps();
            $table->index(['attempt_id', 'plan_version_id', 'status'], 'dispatch_override_attempt_plan_status_index');
            $table->index(['workspace_key', 'requested_by', 'status'], 'dispatch_override_owner_status_index');
        });

        Schema::table('dispatch_audit_lineage', function (Blueprint $table): void {
            $table->foreignId('emergency_override_id')->nullable()->after('idempotency_key_id')->constrained('dispatch_emergency_overrides')->restrictOnDelete();
            $table->index(['emergency_override_id'], 'dispatch_audit_lineage_override_index');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table dispatch_assignment_offers drop constraint if exists dispatch_offers_status_check');
            DB::statement("alter table dispatch_assignment_offers add constraint dispatch_offers_status_check check (status in ('proposed', 'offered', 'accepted', 'rejected', 'withdrawn', 'expired', 'ended'))");
            DB::statement("alter table dispatch_plan_requirement_slots add constraint dispatch_plan_requirement_slots_kind_check check (kind in ('personnel', 'asset'))");
            DB::statement("alter table dispatch_emergency_overrides add constraint dispatch_emergency_overrides_status_check check (status in ('proposed', 'approved', 'rejected', 'expired', 'consumed'))");
            DB::statement('alter table dispatch_emergency_overrides add constraint dispatch_emergency_overrides_expiry_check check (expires_at > created_at)');
        }
    }

    public function down(): void
    {
        Schema::table('dispatch_audit_lineage', function (Blueprint $table): void {
            $table->dropForeign(['emergency_override_id']);
            $table->dropIndex('dispatch_audit_lineage_override_index');
            $table->dropColumn('emergency_override_id');
        });

        Schema::dropIfExists('dispatch_emergency_overrides');
        Schema::dropIfExists('dispatch_plan_requirement_slots');

        Schema::table('dispatch_plan_approvals', function (Blueprint $table): void {
            $table->dropIndex('dispatch_plan_approval_decision_index');
            $table->dropColumn('request_reason');
        });

        Schema::table('dispatch_assignment_offers', function (Blueprint $table): void {
            $table->dropForeign(['ended_by']);
            $table->dropIndex('dispatch_offer_attempt_plan_status_index');
            $table->dropColumn(['ended_at', 'ended_by', 'ended_reason']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table dispatch_assignment_offers drop constraint if exists dispatch_offers_status_check');
            DB::statement("alter table dispatch_assignment_offers add constraint dispatch_offers_status_check check (status in ('proposed', 'offered', 'accepted', 'rejected', 'withdrawn', 'expired'))");
        }
    }
};
