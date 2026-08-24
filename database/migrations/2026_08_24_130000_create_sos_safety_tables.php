<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sos_incidents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('command_id')->unique();
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category', 40)->default('unclassified')->index();
            $table->string('status', 24)->default('active')->index();
            $table->text('worker_note')->nullable();
            $table->timestamp('device_activated_at');
            $table->timestamp('received_at')->index();
            $table->timestamp('escalation_due_at')->index();
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->timestamp('escalated_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolution_code', 48)->nullable();
            $table->text('resolution_notes')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('accuracy_metres', 10, 2)->nullable();
            $table->timestamp('location_captured_at')->nullable();
            $table->timestamp('location_pruned_at')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->index(['reporter_id', 'status', 'created_at']);
            $table->index(['status', 'escalation_due_at']);
            $table->index(['dispatch_job_id', 'created_at']);
            $table->index(['operational_asset_id', 'created_at']);
        });

        Schema::create('sos_incident_recipients', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('sos_incident_id')->constrained('sos_incidents')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('role_at_alert', 40);
            $table->string('resolution_reason', 48);
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('acknowledged_notification_at')->nullable();
            $table->timestamps();
            $table->unique(['sos_incident_id', 'user_id']);
            $table->index(['user_id', 'notified_at']);
        });

        Schema::create('sos_emergency_contacts', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 160);
            $table->string('role_label', 120);
            $table->text('phone_e164');
            $table->char('phone_hash', 64)->unique();
            $table->unsignedSmallInteger('escalation_order')->default(1)->index();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('sos_delivery_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('sos_incident_id')->constrained('sos_incidents')->cascadeOnDelete();
            $table->string('channel', 24);
            $table->string('target_type', 32);
            $table->string('target_id', 128)->nullable();
            $table->string('attempt_status', 24)->index();
            $table->string('provider_reference', 160)->nullable();
            $table->string('failure_code', 80)->nullable();
            $table->timestamp('attempted_at');
            $table->timestamp('delivered_at')->nullable();
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->timestamps();
            $table->index(['sos_incident_id', 'channel', 'target_id']);
            $table->unique(['sos_incident_id', 'channel', 'target_type', 'target_id'], 'sos_delivery_attempts_idempotency_unique');
        });

        Schema::table('notifications', function (Blueprint $table): void {
            $table->foreignUuid('sos_incident_id')->nullable()->after('dispatch_job_id')->constrained('sos_incidents')->nullOnDelete();
            $table->index(['sos_incident_id', 'created_at']);
            $table->unique(['sos_incident_id', 'notifiable_type', 'notifiable_id'], 'notifications_sos_recipient_unique');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table sos_incidents add constraint sos_incidents_category_check check (category in ('unclassified', 'vehicular_accident', 'site_accident', 'critical_asset_malfunction', 'other_immediate_danger'))");
            DB::statement("alter table sos_incidents add constraint sos_incidents_status_check check (status in ('active', 'escalated', 'acknowledged', 'resolved', 'cancelled'))");
            DB::statement('alter table sos_incidents add constraint sos_incidents_coordinates_check check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))');
            DB::statement('alter table sos_incidents add constraint sos_incidents_accuracy_check check (accuracy_metres is null or accuracy_metres >= 0)');
            DB::statement('create unique index sos_incidents_one_unresolved_per_reporter on sos_incidents (reporter_id) where status in (\'active\', \'escalated\', \'acknowledged\')');
            DB::statement("alter table sos_delivery_attempts add constraint sos_delivery_attempts_status_check check (attempt_status in ('pending', 'delivered', 'failed', 'skipped'))");
        }
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('sos_incident_id');
        });
        Schema::dropIfExists('sos_delivery_attempts');
        Schema::dropIfExists('sos_emergency_contacts');
        Schema::dropIfExists('sos_incident_recipients');
        Schema::dropIfExists('sos_incidents');
    }
};
