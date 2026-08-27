<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    if (DB::connection()->getDriverName() !== 'pgsql') {
        $this->markTestSkipped('PostgreSQL server-only security suite requires a pgsql connection.');
    }
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

it('proves the five SOS safety and sequence tables have RLS, no policies, and no Data API grants', function (): void {
    $tables = sosAndSequenceServerOnlyTables();
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

    foreach (sosExpectedSequences() as $sequence) {
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

/** @return list<string> */
function sosAndSequenceServerOnlyTables(): array
{
    return [
        'dispatch_reference_sequences',
        'sos_incidents',
        'sos_incident_recipients',
        'sos_emergency_contacts',
        'sos_delivery_attempts',
    ];
}

/** @return list<string> */
function sosExpectedSequences(): array
{
    $tables = [
        'sos_incident_recipients',
        'sos_emergency_contacts',
        'sos_delivery_attempts',
    ];

    return array_map(
        static fn (string $table): string => (string) DB::selectOne(
            "select pg_get_serial_sequence('public.{$table}', 'id') as qualified_name",
        )->qualified_name,
        $tables,
    );
}
