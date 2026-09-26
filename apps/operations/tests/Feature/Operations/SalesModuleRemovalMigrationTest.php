<?php

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

const SALES_REMOVAL_TABLES = [
    'sales_delivery_evidences',
    'ownership_transfers',
    'sales_inventory_ledger',
    'sales_order_items',
    'sales_orders',
    'sales_quote_items',
    'sales_quotes',
    'sales_catalog_items',
];

function salesRemovalMigration(): Migration
{
    return require database_path('migrations/2026_09_25_130000_remove_sales_module.php');
}

function salesRemovalDispatchJob(User $actor, string $reference, array $attributes = []): DispatchJob
{
    return DispatchJob::query()->create(array_merge([
        'reference' => $reference,
        'client' => 'Legacy sales customer',
        'title' => 'Legacy sales delivery',
        'site' => 'Legacy warehouse',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
    ], $attributes));
}

/** @return int the inserted handoff id */
function salesRemovalHandoff(User $actor, DispatchJob $job, string $sourceType, int $sourceId): int
{
    return DB::table('dispatch_handoffs')->insertGetId([
        'workspace_key' => 'operations',
        'source_system' => 'core2',
        'source_type' => $sourceType,
        'source_id' => $sourceId,
        'source_reference' => $job->reference,
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $actor->id,
        'compatibility_state' => 'legacy_only',
        'created_at' => now(),
        'updated_at' => now(),
    ]);
}

it('leaves no sales tables, routes, or permissions after migrations and seeding', function (): void {
    $this->seed(RolePermissionSeeder::class);

    foreach (SALES_REMOVAL_TABLES as $table) {
        expect(Schema::hasTable($table))->toBeFalse("Expected retired {$table} to be dropped.");
    }

    expect(Permission::query()->where('name', 'like', 'sales.%')->exists())->toBeFalse()
        ->and(collect(Route::getRoutes()->getRoutesByName())->keys()->filter(fn (string $name): bool => str_starts_with($name, 'sales.'))->all())->toBe([]);
});

it('converts sale-sourced dispatches to direct dispatches and removes sales permissions and morph rows', function (): void {
    $actor = User::factory()->create();
    $saleJob = salesRemovalDispatchJob($actor, 'DSP-LEGACY-SALE', [
        'source_type' => 'sales_order',
        'source_id' => 4242,
        'source_reference' => 'SO-LEGACY-4242',
    ]);
    $rentalJob = salesRemovalDispatchJob($actor, 'DSP-KEEP-RENTAL', [
        'source_type' => 'rental_reservation',
        'source_id' => 77,
        'source_reference' => 'REN-KEEP-77',
    ]);
    $saleHandoffId = salesRemovalHandoff($actor, $saleJob, 'sales_order', 4242);
    $rentalHandoffId = salesRemovalHandoff($actor, $rentalJob, 'rental_reservation', 77);

    $salesPermission = Permission::query()->create(['name' => 'sales.view', 'guard_name' => 'web']);
    $keptPermission = Permission::query()->create(['name' => 'rental.view', 'guard_name' => 'web']);
    $role = Role::query()->create(['name' => 'legacy-sales-role', 'guard_name' => 'web']);
    $role->givePermissionTo([$salesPermission, $keptPermission]);

    $approvalBase = [
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Pending->value,
        'requested_by' => $actor->id,
        'reason' => 'Legacy approval',
        'created_at' => now(),
        'updated_at' => now(),
    ];
    DB::table('approval_requests')->insert([...$approvalBase, 'subject_type' => 'sales_order', 'subject_id' => 4242]);
    DB::table('approval_requests')->insert([...$approvalBase, 'subject_type' => $rentalJob->getMorphClass(), 'subject_id' => $rentalJob->id]);

    salesRemovalMigration()->up();

    $saleJobRow = DB::table('dispatch_jobs')->where('id', $saleJob->id)->first();
    $saleHandoff = DB::table('dispatch_handoffs')->where('id', $saleHandoffId)->first();
    $rentalHandoff = DB::table('dispatch_handoffs')->where('id', $rentalHandoffId)->first();

    expect($saleJobRow->source_type)->toBeNull()
        ->and($saleJobRow->source_id)->toBeNull()
        ->and($saleJobRow->source_reference)->toBeNull()
        ->and($saleHandoff->source_type)->toBe('manual')
        ->and((int) $saleHandoff->source_id)->toBe($saleJob->id)
        ->and((int) $saleHandoff->legacy_dispatch_job_id)->toBe($saleJob->id);

    expect(DB::table('dispatch_jobs')->where('id', $rentalJob->id)->value('source_type'))->toBe('rental_reservation')
        ->and($rentalHandoff->source_type)->toBe('rental_reservation')
        ->and((int) $rentalHandoff->source_id)->toBe(77);

    expect(Permission::query()->where('name', 'like', 'sales.%')->exists())->toBeFalse()
        ->and(Permission::query()->where('name', 'rental.view')->exists())->toBeTrue()
        ->and($role->fresh()->permissions->pluck('name')->all())->toBe(['rental.view']);

    expect(DB::table('approval_requests')->where('subject_type', 'sales_order')->exists())->toBeFalse()
        ->and(DB::table('approval_requests')->where('subject_type', $rentalJob->getMorphClass())->count())->toBe(1);

    foreach (SALES_REMOVAL_TABLES as $table) {
        expect(Schema::hasTable($table))->toBeFalse("Expected retired {$table} to be dropped.");
    }
});

it('refuses to convert a sales handoff when a direct handoff already owns the dispatch id', function (): void {
    $actor = User::factory()->create();
    $saleJob = salesRemovalDispatchJob($actor, 'DSP-LEGACY-COLLIDE', ['source_type' => 'sales_order', 'source_id' => 9]);
    $manualJob = salesRemovalDispatchJob($actor, 'DSP-MANUAL-COLLIDE');
    $saleHandoffId = salesRemovalHandoff($actor, $saleJob, 'sales_order', 9);
    salesRemovalHandoff($actor, $manualJob, 'manual', $saleJob->id);

    expect(fn () => salesRemovalMigration()->up())
        ->toThrow(RuntimeException::class, "Cannot convert sales dispatch handoff {$saleHandoffId}");

    expect(DB::table('dispatch_handoffs')->where('id', $saleHandoffId)->value('source_type'))->toBe('sales_order')
        ->and(DB::table('dispatch_jobs')->where('id', $saleJob->id)->value('source_type'))->toBe('sales_order');
});
