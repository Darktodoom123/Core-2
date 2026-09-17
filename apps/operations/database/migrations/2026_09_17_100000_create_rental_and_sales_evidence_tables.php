<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_handover_evidences', function (Blueprint $table): void {
            $table->id();
            $table->string('workspace_key', 32)->default('operations');
            $table->foreignId('rental_reservation_id')->constrained('rental_reservations')->cascadeOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->foreignId('dispatch_execution_attempt_id')->nullable()->constrained('dispatch_execution_attempts')->nullOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->restrictOnDelete();
            $table->string('handover_type', 24);
            $table->decimal('hour_meter', 10, 2);
            $table->unsignedSmallInteger('fuel_percent');
            $table->string('condition_assessment', 32)->nullable();
            $table->text('condition_notes')->nullable();
            $table->boolean('damage_noted')->default(false);
            $table->text('damage_notes')->nullable();
            $table->json('photos')->default('[]');
            $table->string('signature_path')->nullable();
            $table->string('signee_name');
            $table->string('signee_role')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamps();

            $table->index(['rental_reservation_id', 'handover_type']);
            $table->index('dispatch_job_id');
            $table->index('dispatch_execution_attempt_id');
            $table->index('operational_asset_id');
            $table->index('submitted_by');
            $table->index('workspace_key');
        });

        Schema::create('sales_delivery_evidences', function (Blueprint $table): void {
            $table->id();
            $table->string('workspace_key', 32)->default('operations');
            $table->foreignId('sales_order_id')->constrained('sales_orders')->cascadeOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->foreignId('dispatch_execution_attempt_id')->nullable()->constrained('dispatch_execution_attempts')->nullOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained('operational_assets')->nullOnDelete();
            $table->foreignId('submitted_by')->constrained('users')->restrictOnDelete();
            $table->string('verified_vin', 64);
            $table->json('accessories_checked')->default('[]');
            $table->text('delivery_notes')->nullable();
            $table->json('photos')->default('[]');
            $table->string('signature_path')->nullable();
            $table->string('signee_name');
            $table->string('signee_role');
            $table->timestamp('submitted_at');
            $table->timestamps();

            $table->index('sales_order_id');
            $table->index('dispatch_job_id');
            $table->index('dispatch_execution_attempt_id');
            $table->index('operational_asset_id');
            $table->index('submitted_by');
            $table->index('workspace_key');
        });

        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        $tables = ['rental_handover_evidences', 'sales_delivery_evidences'];

        foreach ($tables as $tableName) {
            DB::statement(sprintf('alter table "public"."%s" enable row level security', $tableName));

            $sequence = DB::selectOne(
                <<<'SQL'
                select n.nspname as schema_name, c.relname as sequence_name
                from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where c.oid = to_regclass(pg_get_serial_sequence(?, 'id'))
                SQL,
                ['public.'.$tableName],
            );

            if ($sequence === null) {
                continue;
            }

            $qualifiedSequence = $this->qualifiedIdentifier(
                (string) $sequence->schema_name,
                (string) $sequence->sequence_name,
            );

            foreach (['anon', 'authenticated'] as $role) {
                if (! $this->roleExists($role)) {
                    continue;
                }

                $quotedRole = $this->identifier($role);
                DB::statement(sprintf(
                    'revoke all privileges on table "public"."%s" from %s',
                    $tableName,
                    $quotedRole,
                ));
                DB::statement(sprintf(
                    'revoke USAGE, SELECT, UPDATE on sequence %s from %s',
                    $qualifiedSequence,
                    $quotedRole,
                ));

                $owner = $this->identifier($this->currentUser());
                DB::statement(sprintf(
                    'alter default privileges for role %s in schema "public" revoke SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on tables from %s',
                    $owner,
                    $quotedRole,
                ));
                DB::statement(sprintf(
                    'alter default privileges for role %s in schema "public" revoke USAGE, SELECT, UPDATE on sequences from %s',
                    $owner,
                    $quotedRole,
                ));
            }
        }
    }

    public function down(): void
    {
        $tables = ['sales_delivery_evidences', 'rental_handover_evidences'];

        foreach ($tables as $tableName) {
            if (DB::connection()->getDriverName() === 'pgsql' && Schema::hasTable($tableName)) {
                DB::statement(sprintf('alter table "public"."%s" disable row level security', $tableName));
            }

            Schema::dropIfExists($tableName);
        }
    }

    private function roleExists(string $role): bool
    {
        $result = DB::selectOne('select exists (select 1 from pg_roles where rolname = ?) as present', [$role]);

        return (bool) ($result->present ?? false);
    }

    private function currentUser(): string
    {
        $result = DB::selectOne('select current_user as username');

        return (string) $result->username;
    }

    private function identifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function qualifiedIdentifier(string $schema, string $identifier): string
    {
        return $this->identifier($schema).'.'.$this->identifier($identifier);
    }
};
