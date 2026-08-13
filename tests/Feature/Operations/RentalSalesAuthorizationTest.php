<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\Models\RentalReservationItem;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Identity\Enums\PermissionName;
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

function r0AuthUser(?RoleName $role = null): User
{
    $user = User::factory()->create();

    if ($role !== null) {
        $user->syncRoles([$role->value]);
    }

    return $user;
}

function r0AuthClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-AUTH-'.fake()->unique()->numerify('####'),
        'company_name' => 'R0 Authorization Customer',
        'status' => 'active',
    ]);
}

function r0AuthReservation(User $creator, Client $client): RentalReservation
{
    $asset = OperationalAsset::query()->create([
        'code' => 'EQ-AUTH-'.fake()->unique()->numerify('###'),
        'name' => 'R0 authorization asset',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-AUTH-'.fake()->unique()->numerify('#####'),
        'client_id' => $client->id,
        'created_by' => $creator->id,
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

    return $reservation;
}

it('denies adjacent module permissions at the Rental and Sales write boundaries', function (): void {
    $client = r0AuthClient();
    $salesPermissionUser = r0AuthUser();
    $salesPermissionUser->givePermissionTo(PermissionName::SalesCreateQuote->value);

    $this->actingAs($salesPermissionUser)
        ->postJson('/operations/rental-reservations', [
            'reference' => 'REN-AUTH-FOREIGN',
            'client_id' => $client->id,
            'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(2)->toDateString(),
            'fulfillment_mode' => 'delivery',
            'items' => [],
        ])
        ->assertForbidden();

    $rentalPermissionUser = r0AuthUser();
    $rentalPermissionUser->givePermissionTo(PermissionName::RentalCreate->value);

    $this->actingAs($rentalPermissionUser)
        ->postJson('/operations/sales/quotes', [
            'reference' => 'QUO-AUTH-FOREIGN',
            'client_id' => $client->id,
            'items' => [],
        ])
        ->assertForbidden();

    expect(RentalReservation::query()->where('reference', 'REN-AUTH-FOREIGN')->exists())->toBeFalse();
    expect(SalesQuote::query()->where('reference', 'QUO-AUTH-FOREIGN')->exists())->toBeFalse();
});

it('keeps Rental checkout separate from Rental approval permission', function (): void {
    $manager = r0AuthUser();
    $manager->givePermissionTo(PermissionName::RentalApprove->value);
    $reservation = r0AuthReservation($manager, r0AuthClient());

    $this->actingAs($manager)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])
        ->assertForbidden();

    expect($this->getConnection()->table('rental_checkouts')->count())->toBe(0);
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);
});

it('requires authentication and an active verified account before Rental writes', function (): void {
    $client = r0AuthClient();
    $payload = [
        'reference' => 'REN-AUTH-BOUNDARY',
        'client_id' => $client->id,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => 'delivery',
        'items' => [],
    ];

    $this->postJson('/operations/rental-reservations', $payload)->assertUnauthorized();

    $inactive = r0AuthUser(RoleName::Dispatcher);
    $inactive->update(['is_active' => false]);
    $this->actingAs($inactive)->postJson('/operations/rental-reservations', $payload)->assertForbidden();

    $unverified = User::factory()->unverified()->create();
    $unverified->syncRoles([RoleName::Dispatcher->value]);
    $this->actingAs($unverified)->postJson('/operations/rental-reservations', $payload)->assertForbidden();
});
