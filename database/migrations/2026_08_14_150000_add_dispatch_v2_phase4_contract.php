<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_handoffs', function (Blueprint $table): void {
            $table->dropUnique(['source_type', 'source_id']);
            $table->string('source_system', 64)->default('core2')->after('workspace_key');
            $table->string('external_reference', 128)->nullable()->after('source_reference');
            $table->char('payload_hash', 64)->nullable()->after('external_reference');
            $table->string('inbound_owner_type', 64)->nullable()->after('payload_hash');
            $table->unsignedBigInteger('inbound_owner_id')->nullable()->after('inbound_owner_type');
            $table->string('inbound_idempotency_key', 128)->nullable()->after('inbound_owner_id');
            $table->timestamp('received_at')->nullable()->after('inbound_idempotency_key');
            $table->timestamp('snapshot_at')->nullable()->after('received_at');
            $table->unique(['workspace_key', 'source_system', 'source_type', 'source_id'], 'dispatch_handoff_source_scope_unique');
            $table->index(['inbound_owner_type', 'inbound_owner_id', 'inbound_idempotency_key'], 'dispatch_handoff_inbound_owner_index');
        });

        DB::table('dispatch_handoffs')->whereNull('external_reference')->update([
            'external_reference' => DB::raw('source_reference'),
        ]);

        Schema::table('dispatch_execution_attempts', function (Blueprint $table): void {
            $table->string('correlation_id', 128)->nullable()->after('handoff_id');
            $table->string('replacement_policy', 64)->nullable()->after('replaces_attempt_id');
            $table->text('replacement_reason')->nullable()->after('replacement_policy');
            $table->index(['handoff_id', 'correlation_id'], 'dispatch_attempt_correlation_index');
        });

        DB::table('dispatch_execution_attempts')->whereNull('correlation_id')->orderBy('id')->chunkById(100, function ($attempts): void {
            foreach ($attempts as $attempt) {
                DB::table('dispatch_execution_attempts')->where('id', $attempt->id)->update([
                    'correlation_id' => 'legacy-dispatch-attempt-'.$attempt->id,
                ]);
            }
        });

        Schema::table('dispatch_idempotency_keys', function (Blueprint $table): void {
            $table->index(['workspace_key', 'idempotency_key'], 'dispatch_idempotency_scope_key_index');
        });

        Schema::table('dispatch_handoffs', function (Blueprint $table): void {
            $table->foreignId('inbound_idempotency_key_id')->nullable()->after('inbound_idempotency_key')->constrained('dispatch_idempotency_keys')->restrictOnDelete();
        });

        Schema::create('dispatch_outbox_messages', function (Blueprint $table): void {
            $table->id();
            $table->string('workspace_key', 64)->default('operations')->index();
            $table->string('dedupe_key', 191)->unique();
            $table->string('topic', 128);
            $table->string('aggregate_type', 128);
            $table->unsignedBigInteger('aggregate_id');
            $table->foreignId('attempt_id')->nullable()->constrained('dispatch_execution_attempts')->restrictOnDelete();
            $table->foreignId('audit_event_id')->nullable()->unique()->constrained('audit_events')->restrictOnDelete();
            $table->foreignId('idempotency_key_id')->nullable()->constrained('dispatch_idempotency_keys')->restrictOnDelete();
            $table->json('payload');
            $table->string('status', 24)->default('pending')->index();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('available_at')->nullable()->index();
            $table->timestamp('delivered_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();
            $table->index(['workspace_key', 'status', 'available_at'], 'dispatch_outbox_delivery_index');
            $table->index(['aggregate_type', 'aggregate_id']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table dispatch_outbox_messages add constraint dispatch_outbox_status_check check (status in ('pending', 'processing', 'delivered', 'failed'))");
            DB::statement('alter table dispatch_outbox_messages add constraint dispatch_outbox_attempts_check check (attempts >= 0)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_outbox_messages');

        Schema::table('dispatch_handoffs', function (Blueprint $table): void {
            $table->dropForeign(['inbound_idempotency_key_id']);
            $table->dropUnique('dispatch_handoff_source_scope_unique');
            $table->dropIndex('dispatch_handoff_inbound_owner_index');
            $table->dropColumn([
                'source_system', 'external_reference', 'payload_hash', 'inbound_owner_type', 'inbound_owner_id',
                'inbound_idempotency_key', 'inbound_idempotency_key_id', 'received_at', 'snapshot_at',
            ]);
            $table->unique(['source_type', 'source_id']);
        });

        Schema::table('dispatch_idempotency_keys', function (Blueprint $table): void {
            $table->dropIndex('dispatch_idempotency_scope_key_index');
        });

        Schema::table('dispatch_execution_attempts', function (Blueprint $table): void {
            $table->dropIndex('dispatch_attempt_correlation_index');
            $table->dropColumn(['correlation_id', 'replacement_policy', 'replacement_reason']);
        });
    }
};
