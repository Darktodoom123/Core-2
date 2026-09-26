<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    expect(DB::connection()->getDriverName())->toBe('pgsql');
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

it('proves the seven server-owned tables have RLS, no policies, and no Data API grants', function (): void {
    $tables = rentalServerOnlyTables();
    $roles = ['anon', 'authenticated'];
    $tablePrivileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];

    foreach ($tables as $table) {
        expect(Schema::hasTable($table))->toBeTrue();
        $rls = DB::selectOne(
            'select c.relrowsecurity as enabled, c.relforcerowsecurity as forced from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = current_schema() and c.relname = ?',
            [$table],
        );
        expect((bool) ($rls->enabled ?? false))->toBeTrue("RLS is not enabled for {$table}.");
        expect((bool) ($rls->forced ?? true))->toBeFalse("RLS is forced for {$table}.");

        $policies = DB::selectOne(
            'select count(*) as count from pg_policies where schemaname = current_schema() and tablename = ?',
            [$table],
        );
        expect((int) ($policies->count ?? 0))->toBe(0, "A policy exists for {$table}.");

        foreach ($roles as $role) {
            expect((bool) DB::selectOne('select exists (select 1 from pg_roles where rolname = ?) as present', [$role])->present)
                ->toBeTrue("The required Data API role {$role} is missing.");

            foreach ($tablePrivileges as $privilege) {
                $allowed = DB::selectOne(
                    'select has_table_privilege(?, ?, ?) as allowed',
                    [$role, 'public.'.$table, $privilege],
                );
                expect((bool) ($allowed->allowed ?? true))->toBeFalse(
                    "{$role} has {$privilege} privilege on {$table}.",
                );
            }
        }
    }

    foreach (rentalExpectedSequences() as $sequence) {
        foreach ($roles as $role) {
            foreach (['USAGE', 'SELECT', 'UPDATE'] as $privilege) {
                $allowed = DB::selectOne(
                    'select has_sequence_privilege(?, ?, ?) as allowed',
                    [$role, $sequence, $privilege],
                );
                expect((bool) ($allowed->allowed ?? true))->toBeFalse(
                    "{$role} has {$privilege} privilege on {$sequence}.",
                );
            }
        }
    }
});

it('drops every retired Sales table and sequence', function (): void {
    foreach (['sales_delivery_evidences', 'ownership_transfers', 'sales_inventory_ledger', 'sales_order_items', 'sales_orders', 'sales_quote_items', 'sales_quotes', 'sales_catalog_items'] as $table) {
        expect(Schema::hasTable($table))->toBeFalse("Retired table {$table} still exists.");
        expect(DB::selectOne('select to_regclass(?) as oid', ['public.'.$table.'_id_seq'])->oid)
            ->toBeNull("Retired sequence for {$table} still exists.");
    }
});

it('does not grant Data API roles access to newly created tables or sequences', function (): void {
    $roles = ['anon', 'authenticated'];
    $probeTable = 'r1_default_acl_probe_'.bin2hex(random_bytes(4));
    $probeSequence = $probeTable.'_id_seq';

    try {
        DB::statement('create table "public"."'.$probeTable.'" (id integer)');
        DB::statement('create sequence "public"."'.$probeSequence.'"');

        foreach ($roles as $role) {
            expect((bool) DB::selectOne('select has_table_privilege(?, ?, ?) as allowed', [$role, 'public.'.$probeTable, 'SELECT'])->allowed)
                ->toBeFalse("Default privileges granted {$role} access to the probe table.");
            expect((bool) DB::selectOne('select has_sequence_privilege(?, ?, ?) as allowed', [$role, 'public.'.$probeSequence, 'USAGE'])->allowed)
                ->toBeFalse("Default privileges granted {$role} access to the probe sequence.");
        }
    } finally {
        DB::statement('drop table if exists "public"."'.$probeTable.'"');
        DB::statement('drop sequence if exists "public"."'.$probeSequence.'"');
    }
});

/** @return list<string> */
function rentalServerOnlyTables(): array
{
    return [
        'rental_reservations', 'rental_reservation_items', 'rental_checkouts', 'rental_returns',
        'report_exports', 'gpt_recommendation_metrics', 'rental_operator_assignments',
    ];
}

/** @return list<string> */
function rentalExpectedSequences(): array
{
    $tables = [
        'rental_reservations', 'rental_reservation_items', 'rental_checkouts', 'rental_returns',
        'gpt_recommendation_metrics', 'rental_operator_assignments',
    ];

    return array_map(
        static fn (string $table): string => (string) DB::selectOne(
            "select pg_get_serial_sequence('public.{$table}', 'id') as qualified_name",
        )->qualified_name,
        $tables,
    );
}
