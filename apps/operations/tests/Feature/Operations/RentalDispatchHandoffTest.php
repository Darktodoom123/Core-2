<?php

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
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

function handoffUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function handoffClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-HANDOFF-'.fake()->unique()->numerify('####'),
        'company_name' => 'Handoff Customer',
        'status' => 'active',
    ]);
}

function handoffAsset(string $code): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'Handoff equipment',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
}

it('creates and links a rental delivery dispatch only after approval', function (): void {
    $dispatcher = handoffUser(RoleName::OperationsManager);
    $manager = handoffUser(RoleName::OperationsManager);
    $client = handoffClient();
    $asset = handoffAsset('EQ-HANDOFF-RENTAL');
    $start = now()->addDays(2);

    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-HANDOFF-1',
        'client_id' => $client->id,
        'start_date' => $start->toDateString(),
        'end_date' => $start->addDay()->toDateString(),
        'fulfillment_mode' => 'delivery',
        'delivery_location' => 'Customer delivery yard',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-HANDOFF-1')->sole();

    expect($reservation->fulfillmentMode())->toBe(RentalFulfillmentMode::Delivery)
        ->and($reservation->dispatchHandoffPayload())->toMatchArray(['ready' => false]);

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/dispatch")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
    expect(DispatchJob::query()->where('source_type', 'rental_reservation')->count())->toBe(0);

    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();

    $response = $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/dispatch")
        ->assertCreated();
    $job = DispatchJob::query()->where('source_type', 'rental_reservation')->sole();

    expect($response->json('data.id'))->toBe($job->id)
        ->and($reservation->fresh()->dispatch_job_id)->toBe($job->id)
        ->and($reservation->fresh()->dispatchJob->is($job))->toBeTrue()
        ->and($job->source->is($reservation->fresh()))->toBeTrue()
        ->and($reservation->fresh()->dispatchHandoffPayload())->toMatchArray([
            'dispatch_job_id' => $job->id,
            'ready' => false,
        ]);

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/dispatch")
        ->assertCreated();
    expect(DispatchJob::query()->where('source_type', 'rental_reservation')->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'rental_reservation.dispatch_linked')->count())->toBe(1);
});

it('does not create dispatch work for a rental pickup', function (): void {
    $dispatcher = handoffUser(RoleName::OperationsManager);
    $manager = handoffUser(RoleName::OperationsManager);
    $client = handoffClient();
    $asset = handoffAsset('EQ-HANDOFF-PICKUP');
    $start = now()->addDays(2);

    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-HANDOFF-PICKUP',
        'client_id' => $client->id,
        'start_date' => $start->toDateString(),
        'end_date' => $start->toDateString(),
        'fulfillment_mode' => 'pickup',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-HANDOFF-PICKUP')->sole();
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/dispatch")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('fulfillment_mode');

    expect($reservation->fresh()->fulfillmentMode())->toBe(RentalFulfillmentMode::Pickup)
        ->and($reservation->fresh()->dispatchHandoffPayload())->toBeNull()
        ->and(DispatchJob::query()->where('source_type', 'rental_reservation')->exists())->toBeFalse();

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])
        ->assertOk();
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::CheckedOut);
});

it('protects the rental dispatch handoff route', function (): void {
    $dispatcher = handoffUser(RoleName::OperationsManager);
    $fieldWorker = handoffUser(RoleName::CraneOperator);
    $client = handoffClient();

    $asset = handoffAsset('EQ-HANDOFF-AUTH');
    $start = now()->addDays(2);
    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-HANDOFF-AUTH',
        'client_id' => $client->id,
        'start_date' => $start->toDateString(),
        'end_date' => $start->toDateString(),
        'fulfillment_mode' => 'delivery',
        'delivery_location' => 'Auth yard',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-HANDOFF-AUTH')->sole();

    $this->actingAs($fieldWorker)
        ->postJson("/operations/rental-reservations/{$reservation->id}/dispatch")
        ->assertForbidden();
});

it('requires a completed rental delivery dispatch before checkout', function (): void {
    $dispatcher = handoffUser(RoleName::OperationsManager);
    $manager = handoffUser(RoleName::OperationsManager);
    $client = handoffClient();
    $asset = handoffAsset('EQ-HANDOFF-CHECKOUT');
    $start = now()->addDays(2);

    $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-HANDOFF-CHECKOUT',
        'client_id' => $client->id,
        'start_date' => $start->toDateString(),
        'end_date' => $start->toDateString(),
        'fulfillment_mode' => 'delivery',
        'delivery_location' => 'Checkout yard',
        'items' => [['operational_asset_id' => $asset->id, 'quantity' => 1, 'rate_cents' => 100]],
    ])->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-HANDOFF-CHECKOUT')->sole();
    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();
    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/dispatch")->assertCreated();
    $job = $reservation->fresh()->dispatchJob;

    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);

    $job->update(['status' => DispatchStatus::Completed]);
    $job->canonicalHandoff->attempts()->sole()->update(['status' => DispatchAttemptStatus::Completed, 'version' => 2]);
    $this->actingAs($dispatcher)
        ->postJson("/operations/rental-reservations/{$reservation->id}/checkout", ['condition' => ['engine' => 'good']])
        ->assertOk();
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::CheckedOut);
});
