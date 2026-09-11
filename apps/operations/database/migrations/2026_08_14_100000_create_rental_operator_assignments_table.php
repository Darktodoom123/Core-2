<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_operator_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_reservation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rental_reservation_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('operator_type', 24);
            $table->foreignId('assigned_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('active_from');
            $table->timestamp('active_until');
            $table->timestamps();
            $table->unique(['rental_reservation_item_id', 'user_id']);
            $table->index(['user_id', 'active_from', 'active_until']);
        });

        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('alter table "public"."rental_operator_assignments" enable row level security');

        $sequence = DB::selectOne(
            <<<'SQL'
            select n.nspname as schema_name, c.relname as sequence_name
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where c.oid = to_regclass(pg_get_serial_sequence(?, 'id'))
            SQL,
            ['public.rental_operator_assignments'],
        );

        if ($sequence === null) {
            throw new RuntimeException(
                'Cannot harden rental_operator_assignments; its id sequence is missing.',
            );
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
                'revoke all privileges on table %s from %s',
                '"public"."rental_operator_assignments"',
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

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql' && Schema::hasTable('rental_operator_assignments')) {
            DB::statement('alter table "public"."rental_operator_assignments" disable row level security');
        }

        Schema::dropIfExists('rental_operator_assignments');
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
