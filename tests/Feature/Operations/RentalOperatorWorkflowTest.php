<?php

use App\Modules\Dispatch\Models\Client;
use App\Modules\Rental\Enums\RentalOperatorType;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
    $this->seed(RolePermissionSeeder::class);
});

function rentalOperatorUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function rentalOperatorClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-OP-'.fake()->unique()->numerify('####'),
        'company_name' => 'Rental Operator Client',
        'status' => 'active',
    ]);
}

function rentalOperatorAsset(string $kind = 'crane'): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => 'EQ-OP-'.fake()->unique()->numerify('####'),
        'name' => 'Rental operator asset',
        'kind' => $kind,
        'status' => AssetStatus::Available,
    ]);
}

function rentalOperatorReservation(
    User $creator,
    OperationalAsset $asset,
    RentalReservationStatus $status = RentalReservationStatus::Reserved,
    ?CarbonImmutable $start = null,
    ?CarbonImmutable $end = null,
): RentalReservation {
    $start ??= CarbonImmutable::now()->addDay()->startOfDay();
    $end ??= $start->addDay();
    $client = rentalOperatorClient();
    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-OP-'.fake()->unique()->numerify('#####'),
        'client_id' => $client->id,
        'created_by' => $creator->id,
        'status' => $status,
        'start_date' => $start->toDateString(),
        'end_date' => $end->toDateString(),
        'fulfillment_mode' => 'delivery',
        'total_cents' => 100,
    ]);

    $reservation->items()->create([
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 100,
        'line_total_cents' => 200,
    ]);

    return $reservation->fresh(['items.asset']);
}

function rentalOperatorCredential(User $operator, RentalOperatorType $type, ?CarbonImmutable $expiresAt = null): void
{
    $operator->personnelProfile()->create(['availability_status' => 'available']);
    $operator->personnelCredentials()->create([
        'kind' => $type === RentalOperatorType::Driver ? 'driver_license' : 'operator_certification',
        'credential_number' => 'CRED-OP-'.fake()->unique()->numerify('#####'),
        'credential_type' => $type->value,
        'issued_at' => CarbonImmutable::now()->subYear()->toDateString(),
        'expires_at' => ($expiresAt ?? CarbonImmutable::now()->addYear())->toDateString(),
        'status' => 'active',
    ]);
}

it('assigns a qualified operator to a reserved rental item', function (): void {
    $dispatcher = rentalOperatorUser(RoleName::Dispatcher, 'Rental dispatcher');
    $operator = rentalOperatorUser(RoleName::CraneOperator, 'Rental crane operator');
    rentalOperatorCredential($operator, RentalOperatorType::CraneOperator);
    $asset = rentalOperatorAsset();
    $reservation = rentalOperatorReservation($dispatcher, $asset);
    $item = $reservation->items->sole();

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operators", [
            'rental_reservation_item_id' => $item->id,
            'user_id' => $operator->id,
            'operator_type' => RentalOperatorType::CraneOperator->value,
        ])
        ->assertOk()
        ->assertJsonPath('data.user_id', $operator->id)
        ->assertJsonPath('data.rental_reservation_item_id', $item->id);

    $this->assertDatabaseHas('rental_operator_assignments', [
        'rental_reservation_id' => $reservation->id,
        'rental_reservation_item_id' => $item->id,
        'user_id' => $operator->id,
        'operator_type' => RentalOperatorType::CraneOperator->value,
        'active_from' => $reservation->start_date->startOfDay()->toDateTimeString(),
        'active_until' => $reservation->end_date->addDay()->startOfDay()->toDateTimeString(),
    ]);
});

it('rejects an operator whose role and credential do not match the rented asset', function (): void {
    $dispatcher = rentalOperatorUser(RoleName::Dispatcher, 'Rental dispatcher');
    $operator = rentalOperatorUser(RoleName::Driver, 'Rental driver');
    rentalOperatorCredential($operator, RentalOperatorType::Driver);
    $reservation = rentalOperatorReservation($dispatcher, rentalOperatorAsset());
    $item = $reservation->items->sole();

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operators", [
            'rental_reservation_item_id' => $item->id,
            'user_id' => $operator->id,
            'operator_type' => RentalOperatorType::Driver->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('operator_type');

    expect($reservation->operatorAssignments()->count())->toBe(0);
});

it('allows the assigned qualified operator to operate checked-out equipment during the rental window', function (): void {
    $dispatcher = rentalOperatorUser(RoleName::Dispatcher, 'Rental dispatcher');
    $operator = rentalOperatorUser(RoleName::CraneOperator, 'Rental crane operator');
    rentalOperatorCredential($operator, RentalOperatorType::CraneOperator);
    $start = CarbonImmutable::now()->startOfDay();
    $reservation = rentalOperatorReservation(
        $dispatcher,
        rentalOperatorAsset(),
        RentalReservationStatus::CheckedOut,
        $start,
        $start->addDay(),
    );
    $item = $reservation->items->sole();
    $item->asset->update(['status' => AssetStatus::Assigned]);
    $reservation->operatorAssignments()->create([
        'rental_reservation_item_id' => $item->id,
        'user_id' => $operator->id,
        'assigned_by' => $dispatcher->id,
        'operator_type' => RentalOperatorType::CraneOperator,
        'active_from' => $start,
        'active_until' => $start->addDays(2),
    ]);
    Carbon::setTestNow($start->addHours(4));

    $this->actingAs($operator)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operation-authorization", [
            'operational_asset_id' => $item->operational_asset_id,
        ])
        ->assertOk()
        ->assertJsonPath('data.authorized', true)
        ->assertJsonPath('data.operational_asset_id', $item->operational_asset_id);
});

it('blocks an unassigned operator even when the operator has the correct role', function (): void {
    $dispatcher = rentalOperatorUser(RoleName::Dispatcher, 'Rental dispatcher');
    $operator = rentalOperatorUser(RoleName::CraneOperator, 'Rental crane operator');
    rentalOperatorCredential($operator, RentalOperatorType::CraneOperator);
    $start = CarbonImmutable::now()->startOfDay();
    $reservation = rentalOperatorReservation(
        $dispatcher,
        rentalOperatorAsset(),
        RentalReservationStatus::CheckedOut,
        $start,
        $start->addDay(),
    );
    $item = $reservation->items->sole();
    $item->asset->update(['status' => AssetStatus::Assigned]);
    Carbon::setTestNow($start->addHours(4));

    $this->actingAs($operator)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operation-authorization", [
            'operational_asset_id' => $item->operational_asset_id,
        ])
        ->assertForbidden();
});

it('blocks operation outside the inclusive rental dates', function (string $position): void {
    $dispatcher = rentalOperatorUser(RoleName::Dispatcher, 'Rental dispatcher');
    $operator = rentalOperatorUser(RoleName::CraneOperator, 'Rental crane operator');
    rentalOperatorCredential($operator, RentalOperatorType::CraneOperator);
    $start = CarbonImmutable::now()->addDays(3)->startOfDay();
    $end = $start->addDay();
    $reservation = rentalOperatorReservation($dispatcher, rentalOperatorAsset(), RentalReservationStatus::CheckedOut, $start, $end);
    $item = $reservation->items->sole();
    $item->asset->update(['status' => AssetStatus::Assigned]);
    $reservation->operatorAssignments()->create([
        'rental_reservation_item_id' => $item->id,
        'user_id' => $operator->id,
        'assigned_by' => $dispatcher->id,
        'operator_type' => RentalOperatorType::CraneOperator,
        'active_from' => $start,
        'active_until' => $end->addDay(),
    ]);
    Carbon::setTestNow($position === 'before' ? $start->subMinute() : $end->addDay());

    $this->actingAs($operator)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operation-authorization", [
            'operational_asset_id' => $item->operational_asset_id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('time');
})->with(['before', 'after']);

it('rechecks operator qualification when operation is requested', function (): void {
    $dispatcher = rentalOperatorUser(RoleName::Dispatcher, 'Rental dispatcher');
    $operator = rentalOperatorUser(RoleName::CraneOperator, 'Rental crane operator');
    rentalOperatorCredential($operator, RentalOperatorType::CraneOperator);
    $start = CarbonImmutable::now()->startOfDay();
    $reservation = rentalOperatorReservation(
        $dispatcher,
        rentalOperatorAsset(),
        RentalReservationStatus::CheckedOut,
        $start,
        $start->addDay(),
    );
    $item = $reservation->items->sole();
    $item->asset->update(['status' => AssetStatus::Assigned]);
    $reservation->operatorAssignments()->create([
        'rental_reservation_item_id' => $item->id,
        'user_id' => $operator->id,
        'assigned_by' => $dispatcher->id,
        'operator_type' => RentalOperatorType::CraneOperator,
        'active_from' => $start,
        'active_until' => $start->addDays(2),
    ]);
    $operator->personnelCredentials()->update(['expires_at' => $start->subDay()->toDateString()]);
    Carbon::setTestNow($start->addHours(4));

    $this->actingAs($operator)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operation-authorization", [
            'operational_asset_id' => $item->operational_asset_id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('operator');
});

it('keeps rental operator assignment and operation behind exact permissions', function (): void {
    $assignmentActor = User::factory()->create(['name' => 'Rental assignment actor']);
    $assignmentActor->givePermissionTo(PermissionName::RentalOperate->value);
    $operator = rentalOperatorUser(RoleName::CraneOperator, 'Rental crane operator');
    rentalOperatorCredential($operator, RentalOperatorType::CraneOperator);
    $reservation = rentalOperatorReservation($assignmentActor, rentalOperatorAsset());
    $item = $reservation->items->sole();

    $this->actingAs($assignmentActor)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operators", [
            'rental_reservation_item_id' => $item->id,
            'user_id' => $operator->id,
            'operator_type' => RentalOperatorType::CraneOperator->value,
        ])
        ->assertForbidden();

    $operationActor = User::factory()->create();
    $operationActor->givePermissionTo(PermissionName::RentalAssignOperator->value);
    $this->actingAs($operationActor)
        ->postJson("/operations/rental-reservations/{$reservation->id}/operation-authorization", [
            'operational_asset_id' => $item->operational_asset_id,
        ])
        ->assertForbidden();
});
