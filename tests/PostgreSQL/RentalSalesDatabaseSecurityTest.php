<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
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

it('proves the fourteen server-owned tables have RLS, no policies, and no Data API grants', function (): void {
    $tables = rentalSalesServerOnlyTables();
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

    foreach (rentalSalesExpectedSequences() as $sequence) {
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

it('keeps the forward schema contracts needed by R1', function (): void {
    $referenceLength = DB::selectOne(
        'select character_maximum_length as length from information_schema.columns where table_schema = current_schema() and table_name = ? and column_name = ?',
        ['sales_orders', 'reference'],
    );

    expect((int) ($referenceLength->length ?? 0))->toBe(64);
    expect(Schema::getColumnType('ownership_transfers', 'operational_asset_id'))->toBeIn(['integer', 'bigint', 'int8']);
});

it('accepts the maximum quote reference and persists its derived order reference on PostgreSQL', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $client = Client::query()->create([
        'code' => 'CLI-PG-REF-0001',
        'company_name' => 'PostgreSQL reference customer',
        'status' => 'active',
    ]);
    $catalog = SalesCatalogItem::query()->create([
        'sku' => 'SKU-PG-REF-0001',
        'name' => 'PostgreSQL reference item',
        'unit_price_cents' => 100,
        'quantity_on_hand' => 1,
        'quantity_reserved' => 0,
        'status' => 'active',
    ]);
    $reference = str_repeat('Q', 48);

    $this->actingAs($dispatcher)->postJson('/operations/sales/quotes', [
        'reference' => $reference,
        'client_id' => $client->id,
        'items' => [['sales_catalog_item_id' => $catalog->id, 'quantity' => 1]],
    ])->assertCreated();
    $quote = SalesQuote::query()->where('reference', $reference)->sole();

    $this->actingAs($manager)
        ->postJson("/operations/sales/quotes/{$quote->id}/accept")
        ->assertCreated();
});

it('reapplies the server-only hardening on upgrade and never restores grants on rollback', function (): void {
    $roles = ['anon', 'authenticated'];
    $migration = require base_path('database/migrations/2026_08_12_100001_harden_rental_sales_server_only_tables.php');

    foreach (rentalSalesLegacyServerOnlyTables() as $table) {
        DB::statement('grant all privileges on table "public"."'.$table.'" to "anon", "authenticated"');
    }
    foreach (rentalSalesLegacyExpectedSequences() as $sequence) {
        DB::statement('grant all privileges on sequence '.$sequence.' to "anon", "authenticated"');
    }

    try {
        $migration->up();
        $migration->up();

        foreach ($roles as $role) {
            expect((bool) DB::selectOne('select has_table_privilege(?, ?, ?) as allowed', [$role, 'public.sales_orders', 'SELECT'])->allowed)
                ->toBeFalse();
        }

        $migration->down();

        foreach (rentalSalesLegacyServerOnlyTables() as $table) {
            $rls = DB::selectOne(
                'select c.relrowsecurity as enabled from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = current_schema() and c.relname = ?',
                [$table],
            );
            expect((bool) ($rls->enabled ?? true))->toBeFalse("RLS remained enabled for {$table} after down().");
        }
        foreach ($roles as $role) {
            expect((bool) DB::selectOne('select has_table_privilege(?, ?, ?) as allowed', [$role, 'public.sales_orders', 'SELECT'])->allowed)
                ->toBeFalse("Rollback restored {$role} table access.");
        }
        foreach (rentalSalesLegacyExpectedSequences() as $sequence) {
            foreach ($roles as $role) {
                expect((bool) DB::selectOne('select has_sequence_privilege(?, ?, ?) as allowed', [$role, $sequence, 'USAGE'])->allowed)
                    ->toBeFalse("Rollback restored {$role} sequence access.");
            }
        }
    } finally {
        $migration->up();
    }

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
function rentalSalesServerOnlyTables(): array
{
    return [
        'rental_reservations', 'rental_reservation_items', 'rental_checkouts', 'rental_returns',
        'sales_catalog_items', 'sales_quotes', 'sales_quote_items', 'sales_orders',
        'sales_order_items', 'sales_inventory_ledger', 'ownership_transfers',
        'report_exports', 'gpt_recommendation_metrics', 'rental_operator_assignments',
    ];
}

/** @return list<string> */
function rentalSalesLegacyServerOnlyTables(): array
{
    return [
        'rental_reservations', 'rental_reservation_items', 'rental_checkouts', 'rental_returns',
        'sales_catalog_items', 'sales_quotes', 'sales_quote_items', 'sales_orders',
        'sales_order_items', 'sales_inventory_ledger', 'ownership_transfers',
        'report_exports', 'gpt_recommendation_metrics',
    ];
}

/** @return list<string> */
function rentalSalesExpectedSequences(): array
{
    $tables = [
        'rental_reservations', 'rental_reservation_items', 'rental_checkouts', 'rental_returns',
        'sales_catalog_items', 'sales_quotes', 'sales_quote_items', 'sales_orders',
        'sales_order_items', 'sales_inventory_ledger', 'ownership_transfers',
        'gpt_recommendation_metrics', 'rental_operator_assignments',
    ];

    return array_map(
        static fn (string $table): string => (string) DB::selectOne(
            "select pg_get_serial_sequence('public.{$table}', 'id') as qualified_name",
        )->qualified_name,
        $tables,
    );
}

/** @return list<string> */
function rentalSalesLegacyExpectedSequences(): array
{
    $tables = [
        'rental_reservations', 'rental_reservation_items', 'rental_checkouts', 'rental_returns',
        'sales_catalog_items', 'sales_quotes', 'sales_quote_items', 'sales_orders',
        'sales_order_items', 'sales_inventory_ledger', 'ownership_transfers',
        'gpt_recommendation_metrics',
    ];

    return array_map(
        static fn (string $table): string => (string) DB::selectOne(
            "select pg_get_serial_sequence('public.{$table}', 'id') as qualified_name",
        )->qualified_name,
        $tables,
    );
}
