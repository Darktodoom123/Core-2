<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private const TABLES = [
        'dispatch_handoffs',
        'dispatch_execution_attempts',
        'dispatch_plan_versions',
        'dispatch_plan_requirement_slots',
        'dispatch_plan_approvals',
        'dispatch_assignment_offers',
        'dispatch_emergency_overrides',
        'dispatch_reconciliation_runs',
        'dispatch_reconciliation_findings',
        'dispatch_audit_lineage',
        'dispatch_outbox_messages',
        'dispatch_idempotency_keys',
    ];

    /** @var list<string> */
    private const SEQUENCE_TABLES = [
        'dispatch_handoffs',
        'dispatch_execution_attempts',
        'dispatch_plan_versions',
        'dispatch_plan_requirement_slots',
        'dispatch_plan_approvals',
        'dispatch_assignment_offers',
        'dispatch_emergency_overrides',
        'dispatch_reconciliation_runs',
        'dispatch_reconciliation_findings',
        'dispatch_audit_lineage',
        'dispatch_outbox_messages',
        'dispatch_idempotency_keys',
    ];

    /** @var list<string> */
    private const DATA_API_ROLES = ['anon', 'authenticated'];

    /** @var list<string> */
    private const TABLE_PRIVILEGES = [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE',
        'REFERENCES',
        'TRIGGER',
    ];

    /** @var list<string> */
    private const SEQUENCE_PRIVILEGES = ['USAGE', 'SELECT', 'UPDATE'];

    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        $missing = array_values(array_filter(
            self::TABLES,
            static fn (string $table): bool => ! Schema::hasTable($table),
        ));

        if ($missing !== []) {
            throw new RuntimeException(
                'Cannot harden Dispatch V2 server-only tables; missing tables: '.implode(', ', $missing),
            );
        }

        $sequences = $this->sequences();

        foreach (self::TABLES as $table) {
            DB::statement(sprintf(
                'alter table %s enable row level security',
                $this->qualifiedIdentifier('public', $table),
            ));
        }

        $roles = array_values(array_filter(
            self::DATA_API_ROLES,
            fn (string $role): bool => $this->roleExists($role),
        ));

        foreach ($roles as $role) {
            $quotedRole = $this->identifier($role);

            foreach (self::TABLES as $table) {
                DB::statement(sprintf(
                    'revoke all privileges on table %s from %s',
                    $this->qualifiedIdentifier('public', $table),
                    $quotedRole,
                ));
            }

            foreach ($sequences as $sequence) {
                DB::statement(sprintf(
                    'revoke %s on sequence %s from %s',
                    implode(', ', self::SEQUENCE_PRIVILEGES),
                    $sequence,
                    $quotedRole,
                ));
            }

            $owner = $this->identifier($this->currentUser());
            DB::statement(sprintf(
                'alter default privileges for role %s in schema %s revoke %s on tables from %s',
                $owner,
                $this->identifier('public'),
                implode(', ', self::TABLE_PRIVILEGES),
                $quotedRole,
            ));
            DB::statement(sprintf(
                'alter default privileges for role %s in schema %s revoke %s on sequences from %s',
                $owner,
                $this->identifier('public'),
                implode(', ', self::SEQUENCE_PRIVILEGES),
                $quotedRole,
            ));
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        foreach (self::TABLES as $table) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::statement(sprintf(
                'alter table %s disable row level security',
                $this->qualifiedIdentifier('public', $table),
            ));
        }

        // Data API privileges intentionally remain revoked on rollback. A
        // security rollback must not silently reopen these server-owned tables.
    }

    /** @return list<string> */
    private function sequences(): array
    {
        $sequences = [];

        foreach (self::SEQUENCE_TABLES as $table) {
            $sequence = DB::selectOne(
                <<<'SQL'
                select n.nspname as schema_name, c.relname as sequence_name
                from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where c.oid = to_regclass(pg_get_serial_sequence(?, 'id'))
                SQL,
                ['public.'.$table],
            );

            if ($sequence === null) {
                throw new RuntimeException(
                    'Cannot harden Dispatch V2 server-only tables; missing sequence for '.$table.'.',
                );
            }

            $sequences[] = $this->qualifiedIdentifier(
                (string) $sequence->schema_name,
                (string) $sequence->sequence_name,
            );
        }

        return $sequences;
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
