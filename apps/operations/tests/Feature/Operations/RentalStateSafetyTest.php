<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalCheckout;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function r0StateUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function r0StateClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-R0-'.fake()->unique()->numerify('####'),
        'company_name' => 'R0 Regression Customer',
        'status' => 'active',
    ]);
}

function r0StateAsset(string $code, AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'R0 regression asset',
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

function r0StateReservation(
    User $creator,
    Client $client,
    OperationalAsset $asset,
    RentalReservationStatus $status = RentalReservationStatus::Reserved,
    string $fulfillmentMode = 'delivery',
): RentalReservation {
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $end = $start->addDay();
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-R0-'.fake()->unique()->numerify('#####'),
        'client_id' => $client->id,
        'created_by' => $creator->id,
        'status' => $status,
        'start_date' => $start,
        'end_date' => $end,
        'fulfillment_mode' => $fulfillmentMode,
        'total_cents' => 100,
    ]);

    RentalReservationItem::query()->create([
        'rental_reservation_id' => $reservation->id,
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 200,
    ]);

    return $reservation->fresh();
}

function r0StateDispatchJob(User $creator, CarbonImmutable $start, CarbonImmutable $end): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'DSP-R0-'.fake()->unique()->numerify('#####'),
        'client' => 'R0 Dispatch Customer',
        'title' => 'R0 asset usage regression',
        'site' => 'R0 test site',
        'scheduled_start' => $start,
        'scheduled_end' => $end,
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Scheduled,
        'created_by' => $creator->id,
        'version' => 1,
    ]);
}

it('requires non-empty bounded condition evidence for checkout and return', function (string $operation, string $shape): void {
    $actor = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-CONDITION-'.fake()->unique()->numerify('###'));
    $reservation = r0StateReservation(
        $actor,
        $client,
        $asset,
        $operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut,
    );

    if ($operation === 'return') {
        RentalCheckout::query()->create([
            'rental_reservation_id' => $reservation->id,
            'checked_out_by' => $actor->id,
            'checked_out_at' => now(),
            'condition_before' => ['engine' => 'good'],
        ]);
    }

    $payload = match ($shape) {
        'missing' => [],
        'null' => ['condition' => null],
        'empty' => ['condition' => []],
        'nested' => ['condition' => ['engine' => ['nested']]],
        'blank' => ['condition' => ['engine' => '   ']],
        'oversize' => ['condition' => ['engine' => str_repeat('x', 256)]],
        'too_many_entries' => ['condition' => array_fill_keys(array_map(static fn (int $index): string => "item_{$index}", range(1, 51)), 'good')],
    };
    $url = $operation === 'checkout'
        ? "/operations/rental-reservations/{$reservation->id}/checkout"
        : "/operations/rental-reservations/{$reservation->id}/return";

    $this->actingAs($actor)
        ->postJson($url, $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(in_array($shape, ['nested', 'blank', 'oversize'], true) ? 'condition.engine' : 'condition');

    $evidenceTable = $operation === 'checkout' ? 'rental_checkouts' : 'rental_returns';
    expect($this->getConnection()->table($evidenceTable)->count())->toBe(0);
    expect($reservation->fresh()->status)->toBe(
        $operation === 'checkout' ? RentalReservationStatus::Reserved : RentalReservationStatus::CheckedOut,
    );
})->with([
    ['checkout', 'missing'],
    ['checkout', 'null'],
    ['checkout', 'empty'],
    ['checkout', 'nested'],
    ['checkout', 'blank'],
    ['checkout', 'oversize'],
    ['checkout', 'too_many_entries'],
    ['return', 'missing'],
    ['return', 'null'],
    ['return', 'empty'],
    ['return', 'nested'],
    ['return', 'blank'],
    ['return', 'oversize'],
    ['return', 'too_many_entries'],
]);

it('revalidates rental checkout after each operational blocker appears', function (string $blocker): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $manager = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-LATE-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $reservation = r0StateReservation($dispatcher, $client, $asset, RentalReservationStatus::Requested);

    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();

    if ($blocker === 'unavailable') {
        $asset->update(['status' => AssetStatus::Unavailable]);
    } elseif ($blocker === 'maintenance') {
        MaintenanceWorkOrder::query()->create([
            'operational_asset_id' => $asset->id,
            'technician_id' => $manager->id,
            'status' => AssetStatus::UnderMaintenance,
            'defect' => 'R0 blocking maintenance',
            'dispatch_blocking' => true,
        ]);
    } elseif ($blocker === 'dispatch') {
        $job = r0StateDispatchJob($manager, $start->addHours(4), $start->addHours(8));
        DispatchAssetAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $asset->id,
            'assignment_type' => 'equipment',
            'assigned_by' => $manager->id,
            'active_from' => $job->scheduled_start,
        ]);
    }

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);
    expect($this->getConnection()->table('rental_checkouts')->count())->toBe(0);
})->with(['unavailable', 'maintenance', 'dispatch']);

it('keeps rental reservations out of dispatch eligibility', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RENT-DISPATCH-'.fake()->unique()->numerify('###'));
    r0StateReservation($dispatcher, $client, $asset, RentalReservationStatus::Requested);
    $start = CarbonImmutable::now()->addDays(2)->startOfDay()->addHours(2);
    $job = r0StateDispatchJob($dispatcher, $start, $start->addHours(4));

    $assessment = app(DispatchResourceEligibility::class)->asset($asset->fresh(), 'equipment', $job);

    expect($assessment['eligible'])->toBeFalse();
});

it('keeps dispatch assignments out of rental creation', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-DISPATCH-RENT-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $job = r0StateDispatchJob($dispatcher, $start->addHours(2), $start->addHours(5));
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-DISPATCH-CONFLICT',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect(RentalReservation::query()->where('reference', 'REN-R0-DISPATCH-CONFLICT')->exists())->toBeFalse();
});

it('rejects duplicate rental asset IDs before creating a reservation', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-DUPLICATE-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-DUPLICATE',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [
                ['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100],
                ['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items.1.operational_asset_id');

    expect(RentalReservation::query()->where('reference', 'REN-R0-DUPLICATE')->exists())->toBeFalse();
});

it('persists valid rental checkout and return condition evidence as JSON', function (): void {
    $actor = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-EVIDENCE-'.fake()->unique()->numerify('###'));
    $reservation = r0StateReservation($actor, $client, $asset, RentalReservationStatus::Reserved, 'pickup');

    $this->actingAs($actor)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", [
            'condition' => ['engine' => 'good', 'hydraulics' => 'normal'],
        ])
        ->assertOk();

    $this->actingAs($actor)
        ->postJson("/operations/rental-reservations/{$reservation->id}/return", [
            'condition' => ['engine' => 'good', 'hydraulics' => 'normal'],
            'damage_notes' => 'No new damage observed.',
        ])
        ->assertOk();

    expect($reservation->fresh()->checkout->condition_before)->toBe([
        'engine' => 'good',
        'hydraulics' => 'normal',
    ])->and($reservation->fresh()->returnRecord->condition_after)->toBe([
        'engine' => 'good',
        'hydraulics' => 'normal',
    ]);
});

it('allows an exact dispatch end to rental start boundary', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-BOUNDARY-'.fake()->unique()->numerify('###'));
    $start = CarbonImmutable::now()->addDays(2)->startOfDay();
    $job = r0StateDispatchJob($dispatcher, $start->subHours(4), $start);
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'equipment',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-BOUNDARY',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
        ])
        ->assertCreated();
});

it('rejects generic operational restoration of an unavailable asset', function (): void {
    $manager = r0StateUser(RoleName::OperationsManager);
    $asset = r0StateAsset('EQ-R0-TERMINAL-'.fake()->unique()->numerify('###'), AssetStatus::Unavailable);
    Inspection::query()->create([
        'operational_asset_id' => $asset->id,
        'technician_id' => $manager->id,
        'type' => 'safety',
        'result' => 'passed',
        'checklist' => ['terminal' => true],
        'completed_at' => now(),
    ]);

    $this->actingAs($manager)
        ->postJson("/operations/assets/{$asset->id}/status", [
            'status' => AssetStatus::Available->value,
            'reason' => 'Attempted generic restoration',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    expect($asset->fresh()->status)->toBe(AssetStatus::Unavailable);
});

it('rejects rental line multiplication overflow before persistence', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RATE-OVERFLOW');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RATE-OVERFLOW',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->addDay()->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 2_147_483_647]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');
});

it('accepts the maximum safe rental line total', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RENTAL-MAX');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RENTAL-MAX',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 2_147_483_647]],
        ])
        ->assertCreated();

    $reservation = RentalReservation::query()->where('reference', 'REN-R0-RENTAL-MAX')->sole();
    expect($reservation->total_cents)->toBe(2_147_483_647)
        ->and($reservation->items()->sole()->line_total_cents)->toBe(2_147_483_647);
});

it('rejects a rental rate above the signed integer maximum', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $asset = r0StateAsset('EQ-R0-RENTAL-OVER-MAX');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RENTAL-OVER-MAX',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 2_147_483_648]],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items.0.rate_cents');

    expect(RentalReservation::query()->where('reference', 'REN-R0-RENTAL-OVER-MAX')->exists())->toBeFalse();
});

it('rejects rental aggregate overflow before persistence', function (): void {
    $dispatcher = r0StateUser(RoleName::OperationsManager);
    $client = r0StateClient();
    $first = r0StateAsset('EQ-R0-RENTAL-AGG-1');
    $second = r0StateAsset('EQ-R0-RENTAL-AGG-2');
    $start = CarbonImmutable::now()->addDays(2);

    $this->actingAs($dispatcher)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-R0-RENTAL-AGG-OVERFLOW',
            'client_id' => $client->id,
            'start_date' => $start->toDateString(),
            'end_date' => $start->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [
                ['operational_asset_id' => $first->id, 'quantity' => 1, 'rate_cents' => 2_147_483_647],
                ['operational_asset_id' => $second->id, 'quantity' => 1, 'rate_cents' => 1],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect(RentalReservation::query()->where('reference', 'REN-R0-RENTAL-AGG-OVERFLOW')->exists())->toBeFalse();
});

it('freezes the Rental module boundary against retired Sales imports and tables', function (): void {
    $rentalFiles = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(base_path('app/Modules/Rental'))) as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $rentalFiles[] = $file->getPathname();
        }
    }

    expect($rentalFiles)->not->toBeEmpty();

    foreach ($rentalFiles as $file) {
        $contents = file_get_contents($file);
        expect($contents)->not->toContain('App\\Modules\\Sales\\');
        expect($contents)->not->toContain('sales_catalog_items');
        expect($contents)->not->toContain('sales_orders');
    }
});
