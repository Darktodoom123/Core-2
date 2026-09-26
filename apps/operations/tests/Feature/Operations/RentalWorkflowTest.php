<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function workflowUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function workflowClient(): Client
{
    return Client::query()->create(['code' => 'CLI-'.fake()->unique()->numerify('####'), 'company_name' => 'Alibaton Customer', 'status' => 'active']);
}

it('completes an authorized rental reservation checkout and return with conflict protection', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-RENT-1', 'name' => 'Crawler crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $dates = ['start_date' => now()->addDays(2)->toDateString(), 'end_date' => now()->addDays(3)->toDateString()];
    $payload = [
        'reference' => 'REN-1001', 'client_id' => $client->id, ...$dates,
        'fulfillment_mode' => 'pickup', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 250000]],
    ];

    $created = $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', $payload)->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-1001')->sole();
    expect($reservation->status)->toBe(RentalReservationStatus::Requested)->and($reservation->total_cents)->toBe(500000);

    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();
    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])->assertOk();
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::CheckedOut)->and($asset->fresh()->status)->toBe(AssetStatus::Assigned);

    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/return", ['condition' => ['engine' => 'good']])->assertOk();
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Returned)->and($asset->fresh()->status)->toBe(AssetStatus::Available);

    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [...$payload, 'reference' => 'REN-1002'])->assertCreated();
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [...$payload, 'reference' => 'REN-1003'])->assertUnprocessable()->assertJsonValidationErrors('items');
});

it('keeps rental writes behind their dedicated permissions', function (): void {
    $fieldWorker = workflowUser(RoleName::CraneOperator);
    $client = workflowClient();

    $this->actingAs($fieldWorker)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-FORBIDDEN',
            'client_id' => $client->id,
            'start_date' => now()->addDays(2)->toDateString(),
            'end_date' => now()->addDays(3)->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [],
        ])
        ->assertForbidden();

    expect(RentalReservation::query()->where('reference', 'REN-FORBIDDEN')->exists())->toBeFalse();
});

it('rechecks asset availability and quantity when approving a rental', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-RECHECK-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $payload = [
        'reference' => 'REN-RECHECK-1', 'client_id' => $client->id,
        'start_date' => now()->addDays(2)->toDateString(), 'end_date' => now()->addDays(3)->toDateString(),
        'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ];
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [...$payload, 'reference' => 'REN-RECHECK-2', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 2, 'rate_cents' => 100]]])->assertUnprocessable()->assertJsonValidationErrors('items.0.quantity');
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', $payload)->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-RECHECK-1')->sole();
    $asset->update(['status' => AssetStatus::Unavailable]);
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('rejects an approval when another reservation conflicts with the same unit', function (): void {
    $dispatcher = workflowUser(RoleName::OperationsManager);
    $manager = workflowUser(RoleName::OperationsManager);
    $client = workflowClient();
    $asset = OperationalAsset::query()->create(['code' => 'EQ-CONFLICT-1', 'name' => 'Crane', 'kind' => 'equipment', 'status' => AssetStatus::Available]);
    $start = now()->addDays(4)->toDateString();
    $end = now()->addDays(5)->toDateString();
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-CONFLICT-1', 'client_id' => $client->id, 'start_date' => $start, 'end_date' => $end,
        'fulfillment_mode' => 'delivery', 'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-CONFLICT-1')->sole();
    $other = RentalReservation::query()->create(['reference' => 'REN-CONFLICT-2', 'client_id' => $client->id, 'created_by' => $dispatcher->id, 'status' => RentalReservationStatus::Requested, 'start_date' => $start, 'end_date' => $end, 'fulfillment_mode' => 'delivery', 'total_cents' => 100]);
    RentalReservationItem::query()->create(['rental_reservation_id' => $other->id, 'operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100, 'line_total_cents' => 100]);
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertUnprocessable()->assertJsonValidationErrors('status');
});
