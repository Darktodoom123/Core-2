<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Platform\Audit\Models\AuditEvent;
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

function r0AuditUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function r0AuditClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-AUDIT-'.fake()->unique()->numerify('####'),
        'company_name' => 'R0 Audit Customer',
        'status' => 'active',
    ]);
}

it('does not expose private Rental notes in transition audit snapshots', function (): void {
    $dispatcher = r0AuditUser(RoleName::OperationsManager);
    $manager = r0AuditUser(RoleName::OperationsManager);
    $client = r0AuditClient();
    $asset = OperationalAsset::query()->create([
        'code' => 'EQ-AUDIT-'.fake()->unique()->numerify('###'),
        'name' => 'R0 audit asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);

    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-AUDIT-PRIVATE',
        'client_id' => $client->id,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => 'pickup',
        'notes' => 'private customer contact detail',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-AUDIT-PRIVATE')->sole();
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();
    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/checkout", [
        'condition' => ['engine' => 'good'],
    ])->assertOk();

    $audit = AuditEvent::query()->where('action', 'rental_reservation.checked_out')->sole();

    expect($audit->after)->not->toHaveKey('notes');
    expect(json_encode($audit->after, JSON_THROW_ON_ERROR))->not->toContain('private customer contact detail');
});

it('does not create a success audit when checkout validation fails', function (): void {
    $dispatcher = r0AuditUser(RoleName::OperationsManager);
    $client = r0AuditClient();
    $asset = OperationalAsset::query()->create([
        'code' => 'EQ-AUDIT-FAIL-'.fake()->unique()->numerify('###'),
        'name' => 'R0 failed audit asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-AUDIT-FAIL',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => 'delivery',
        'total_cents' => 100,
    ]);
    RentalReservationItem::query()->create([
        'rental_reservation_id' => $reservation->id,
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 200,
    ]);

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout")
        ->assertUnprocessable();

    expect(AuditEvent::query()->where('action', 'rental_reservation.checked_out')->exists())->toBeFalse();
});
