<?php

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalHandoverEvidence;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('public');
    Storage::fake('private');
});

function createRentalTestEntities(): array
{
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $operatorToken = $operator->createToken('Mobile Operator Token')->plainTextToken;

    $client = Client::query()->create([
        'code' => 'CLI-TEST-'.Str::random(4),
        'company_name' => 'First Balfour Construction',
        'status' => 'active',
    ]);

    $asset = OperationalAsset::query()->create([
        'code' => 'EQ-RENT-'.Str::random(4),
        'name' => '50T Tadano Crane',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);

    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-TEST-'.Str::random(6),
        'client_id' => $client->id,
        'created_by' => $manager->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => RentalFulfillmentMode::Delivery,
        'delivery_location' => 'Depot Bay 4',
        'total_cents' => 100000,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-RENT-'.Str::random(6),
        'client' => $client->company_name,
        'title' => 'Rental Delivery Dispatch',
        'site' => 'Depot Bay 4',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $manager->id,
        'source_type' => DispatchSourceType::RentalReservation->value,
        'source_id' => $reservation->id,
    ]);

    $reservation->update(['dispatch_job_id' => $job->id]);

    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'legacy_dispatch_job_id' => $job->id,
        'source_type' => DispatchSourceType::RentalReservation->value,
        'source_id' => $reservation->id,
        'source_reference' => $reservation->reference,
        'external_reference' => $reservation->reference,
        'status' => 'active',
    ]);

    $attempt = DispatchExecutionAttempt::query()->create([
        'workspace_key' => 'operations',
        'handoff_id' => $handoff->id,
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Working,
        'version' => 1,
    ]);

    $job->personnelAssignments()->create([
        'user_id' => $operator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $manager->id,
        'active_from' => now()->subHour(),
    ]);

    return [
        'manager' => $manager,
        'operator' => $operator,
        'operatorToken' => $operatorToken,
        'reservation' => $reservation,
        'job' => $job,
        'attempt' => $attempt,
    ];
}

it('records rental checkout handover evidence, completes linked dispatch attempt, and satisfies idempotency', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation, 'job' => $job, 'attempt' => $attempt] = createRentalTestEntities();

    $commandId = (string) Str::uuid();
    $mockSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    $mockPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    $payload = [
        'handover_type' => 'checkout',
        'hour_meter' => 1420.5,
        'fuel_percent' => 95,
        'condition_assessment' => 'excellent',
        'condition_notes' => 'Zero safety defects observed. Ready for site operation.',
        'signee_name' => 'Engr. Antonio Santos',
        'signee_role' => 'Site Operations Engineer',
        'signature_base64' => $mockSignature,
        'photos' => [
            [
                'base64' => $mockPhoto,
                'label' => 'Front Boom Walkaround',
            ],
        ],
        'command_id' => $commandId,
    ];

    $response = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $payload)
        ->assertCreated();

    expect($response->json('message'))->toBe('Rental handover evidence recorded successfully.')
        ->and($response->json('data.hour_meter'))->toBe(1420.5)
        ->and($response->json('data.fuel_percent'))->toBe(95)
        ->and($response->json('data.signee_name'))->toBe('Engr. Antonio Santos')
        ->and($response->json('data.handover_type'))->toBe('checkout');

    $evidence = RentalHandoverEvidence::query()->where('rental_reservation_id', $reservation->id)->sole();
    expect($evidence->hour_meter)->toEqual(1420.5)
        ->and($evidence->fuel_percent)->toBe(95)
        ->and($evidence->damage_noted)->toBeFalse()
        ->and($evidence->signature_path)->not->toBeNull()
        ->and(count($evidence->photos))->toBe(1);

    // Linked dispatch job and attempt progressed to completed
    expect($job->fresh()->status)->toBe(DispatchStatus::Completed)
        ->and($attempt->fresh()->status)->toBe(DispatchAttemptStatus::Completed);

    // Rental reservation remains in Reserved status (managerial checkout action required)
    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);

    // Replaying same command_id idempotently returns identical response
    $replayResponse = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $payload)
        ->assertCreated();

    expect($replayResponse->json('data.id'))->toBe($response->json('data.id'));

    // Submitting conflicting payload with same command_id is rejected with 422
    $conflictingPayload = array_merge($payload, ['hour_meter' => 9999.0]);
    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $conflictingPayload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('command_id');
});

it('records return check-in evidence with damage details flagged', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation] = createRentalTestEntities();

    $reservation->update(['status' => RentalReservationStatus::CheckedOut]);

    $commandId = (string) Str::uuid();
    $payload = [
        'handover_type' => 'return',
        'hour_meter' => 1550.0,
        'fuel_percent' => 80,
        'condition_assessment' => 'fair',
        'condition_notes' => 'Returned after 48-hour rental.',
        'damage_noted' => true,
        'damage_notes' => 'Dent on rear right stabilizer outrigger pad.',
        'signee_name' => 'Engr. Rafael Mendoza',
        'signee_role' => 'Receiving Inspector',
        'command_id' => $commandId,
    ];

    $response = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/rentals/{$reservation->id}/return", $payload)
        ->assertCreated();

    expect($response->json('data.damage_noted'))->toBeTrue()
        ->and($response->json('data.damage_notes'))->toBe('Dent on rear right stabilizer outrigger pad.')
        ->and($response->json('data.handover_type'))->toBe('return');

    $evidence = RentalHandoverEvidence::query()->where('rental_reservation_id', $reservation->id)->sole();
    expect($evidence->damage_noted)->toBeTrue()
        ->and($evidence->damage_notes)->toBe('Dent on rear right stabilizer outrigger pad.');
});

it('rejects unauthenticated requests to rental handover endpoints', function (): void {
    ['reservation' => $reservation] = createRentalTestEntities();

    $this->postJson("/api/v1/rentals/{$reservation->id}/handover", ['hour_meter' => 10, 'fuel_percent' => 100, 'signee_name' => 'John'])
        ->assertUnauthorized();
});

it('rejects unauthorized users from submitting handover evidence', function (): void {
    ['reservation' => $reservation] = createRentalTestEntities();

    // Unauthorized user has no rental/dispatch permissions
    $unauthorizedUser = User::factory()->create(['is_active' => true]);
    $token = $unauthorizedUser->createToken('Unauthorized Token')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/handover", [
            'hour_meter' => 100.0,
            'fuel_percent' => 100,
            'signee_name' => 'Intruder',
        ])
        ->assertForbidden();
});

it('validates required fields on rental handover submission', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation] = createRentalTestEntities();

    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/handover", [
            'hour_meter' => -5,
            'fuel_percent' => 150,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['hour_meter', 'fuel_percent', 'signee_name']);
});

it('safely ignores non-image attachment payloads without storing files to disk', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation] = createRentalTestEntities();

    $payload = [
        'handover_type' => 'checkout',
        'hour_meter' => 100.0,
        'fuel_percent' => 90,
        'signee_name' => 'Test Inspector',
        'signature_base64' => 'data:image/png;base64,'.base64_encode('plain text content that is not an image'),
        'photos' => [
            [
                'base64' => 'data:image/jpeg;base64,'.base64_encode('plain text content'),
                'label' => 'Fake Photo',
            ],
        ],
    ];

    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $payload)
        ->assertCreated();

    $evidence = RentalHandoverEvidence::query()->where('rental_reservation_id', $reservation->id)->sole();
    expect($evidence->signature_path)->toBeNull()
        ->and($evidence->photos)->toBeEmpty();

    expect(Storage::disk('public')->allFiles('rental_evidence'))->toBeEmpty();
});

it('compensates and removes staged storage files if database transaction fails', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation] = createRentalTestEntities();

    RentalHandoverEvidence::saving(function (): void {
        throw new RuntimeException('Simulated database write failure during handover');
    });

    $validBase64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    $payload = [
        'handover_type' => 'checkout',
        'hour_meter' => 100.0,
        'fuel_percent' => 90,
        'signee_name' => 'Test Inspector',
        'signature_base64' => $validBase64Png,
        'photos' => [
            [
                'base64' => $validBase64Png,
                'label' => 'Valid Photo',
            ],
        ],
    ];

    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $payload)
        ->assertStatus(500);

    expect(Storage::disk('public')->allFiles('rental_evidence'))->toBeEmpty();
});

it('binds evidence explicitly to selected job and asset when operator has multiple matching assignments', function (): void {
    ['operator' => $operator, 'operatorToken' => $token, 'reservation' => $reservationA, 'job' => $jobA, 'attempt' => $attemptA] = createRentalTestEntities();

    // Create a second active reservation, job, and attempt assigned to the same operator
    $manager = User::query()->where('email', '!=', $operator->email)->first();
    $client = Client::query()->first();

    $assetB = OperationalAsset::query()->create([
        'code' => 'EQ-RENT-'.Str::random(4),
        'name' => '80T Liebherr Crane',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);

    $reservationB = RentalReservation::query()->create([
        'reference' => 'REN-TEST-'.Str::random(6),
        'client_id' => $client->id,
        'created_by' => $manager->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(3)->toDateString(),
        'fulfillment_mode' => RentalFulfillmentMode::Delivery,
        'delivery_location' => 'Port Area Pier 7',
        'total_cents' => 200000,
    ]);
    $reservationB->items()->create([
        'operational_asset_id' => $assetB->id,
        'quantity' => 1,
        'rate_cents' => 200,
        'line_total_cents' => 400,
    ]);

    $jobB = DispatchJob::query()->create([
        'reference' => 'DISP-RENT-'.Str::random(6),
        'client' => $client->company_name,
        'title' => 'Second Rental Delivery Dispatch',
        'site' => 'Port Area Pier 7',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $manager->id,
        'source_type' => DispatchSourceType::RentalReservation->value,
        'source_id' => $reservationB->id,
    ]);
    $reservationB->update(['dispatch_job_id' => $jobB->id]);

    $handoffB = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'legacy_dispatch_job_id' => $jobB->id,
        'source_type' => DispatchSourceType::RentalReservation->value,
        'source_id' => $reservationB->id,
        'source_reference' => $reservationB->reference,
        'external_reference' => $reservationB->reference,
        'status' => 'active',
    ]);

    $attemptB = DispatchExecutionAttempt::query()->create([
        'workspace_key' => 'operations',
        'handoff_id' => $handoffB->id,
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Working,
        'version' => 1,
    ]);

    $jobB->personnelAssignments()->create([
        'user_id' => $operator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $manager->id,
        'active_from' => now()->subHour(),
    ]);

    // Submit evidence explicitly selecting Job B and Asset B
    $commandId = (string) Str::uuid();
    $payload = [
        'handover_type' => 'checkout',
        'dispatch_job_id' => $jobB->id,
        'operational_asset_id' => $assetB->id,
        'hour_meter' => 840.0,
        'fuel_percent' => 100,
        'condition_assessment' => 'excellent',
        'signee_name' => 'Engr. Pier Supervisor',
        'command_id' => $commandId,
    ];

    $response = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/rentals/{$reservationB->id}/checkout", $payload)
        ->assertCreated();

    expect($response->json('data.dispatch_job_id'))->toBe($jobB->id)
        ->and($response->json('data.rental_reservation_id'))->toBe($reservationB->id)
        ->and($response->json('data.operational_asset_id'))->toBe($assetB->id);

    // Explicitly targeted Job B and Attempt B are completed
    expect($jobB->fresh()->status)->toBe(DispatchStatus::Completed)
        ->and($attemptB->fresh()->status)->toBe(DispatchAttemptStatus::Completed);

    // Job A and Attempt A remain untouched in Working status
    expect($jobA->fresh()->status)->toBe(DispatchStatus::Working)
        ->and($attemptA->fresh()->status)->toBe(DispatchAttemptStatus::Working);
});

it('enforces assignment boundaries and rejects unassigned operators', function (): void {
    ['reservation' => $reservation] = createRentalTestEntities();

    // Create a different crane operator who is NOT assigned to this reservation or job
    $unassignedOperator = User::factory()->create(['is_active' => true]);
    $unassignedOperator->syncRoles([RoleName::CraneOperator->value]);
    $unassignedToken = $unassignedOperator->createToken('Unassigned Operator Token')->plainTextToken;

    $payload = [
        'handover_type' => 'checkout',
        'hour_meter' => 100.0,
        'fuel_percent' => 90,
        'signee_name' => 'Intruder',
    ];

    $this->withToken($unassignedToken)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $payload)
        ->assertForbidden();
});

it('does not complete dispatch attempt if attempt is not in working or arrived status', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation, 'job' => $job, 'attempt' => $attempt] = createRentalTestEntities();

    // Set job and attempt to Scheduled
    $job->update(['status' => DispatchStatus::Scheduled]);
    $attempt->update(['status' => DispatchAttemptStatus::Draft]);

    $payload = [
        'handover_type' => 'checkout',
        'hour_meter' => 1420.5,
        'fuel_percent' => 95,
        'signee_name' => 'Engr. Antonio Santos',
    ];

    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", $payload)
        ->assertCreated();

    // Evidence is recorded, but job and attempt are NOT forced to Completed
    expect($job->fresh()->status)->toBe(DispatchStatus::Scheduled)
        ->and($attempt->fresh()->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);
});

it('handles multi-asset rental reservation requiring explicit asset identification and completes dispatch attempt only when all assets are evidenced', function (): void {
    ['operatorToken' => $token, 'reservation' => $reservation, 'job' => $job, 'attempt' => $attempt] = createRentalTestEntities();

    $asset1 = OperationalAsset::query()->create([
        'code' => 'EQ-MULTI-1-'.Str::random(4),
        'name' => 'Excavator 20T',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);
    $asset2 = OperationalAsset::query()->create([
        'code' => 'EQ-MULTI-2-'.Str::random(4),
        'name' => 'Bulldozer D6',
        'kind' => 'equipment',
        'status' => AssetStatus::Available,
    ]);

    $reservation->items()->createMany([
        [
            'operational_asset_id' => $asset1->id,
            'quantity' => 1,
            'rate_cents' => 100,
            'line_total_cents' => 100,
        ],
        [
            'operational_asset_id' => $asset2->id,
            'quantity' => 1,
            'rate_cents' => 100,
            'line_total_cents' => 100,
        ],
    ]);

    // 1. Submitting without operational_asset_id when multi-asset rental is rejected with 422
    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", [
            'handover_type' => 'checkout',
            'hour_meter' => 100.0,
            'fuel_percent' => 90,
            'signee_name' => 'Supervisor',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['operational_asset_id']);

    // 2. Submitting evidence for Asset 1 records evidence but does NOT complete dispatch attempt
    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", [
            'handover_type' => 'checkout',
            'operational_asset_id' => $asset1->id,
            'hour_meter' => 100.0,
            'fuel_percent' => 90,
            'signee_name' => 'Supervisor',
        ])
        ->assertCreated();

    expect(RentalHandoverEvidence::query()->where('rental_reservation_id', $reservation->id)->count())->toBe(1)
        ->and($job->fresh()->status)->toBe(DispatchStatus::Working)
        ->and($attempt->fresh()->status)->toBe(DispatchAttemptStatus::Working);

    // 3. Submitting evidence for Asset 2 completes all assets and therefore transitions attempt and job to Completed
    $this->withToken($token)
        ->postJson("/api/v1/rentals/{$reservation->id}/checkout", [
            'handover_type' => 'checkout',
            'operational_asset_id' => $asset2->id,
            'hour_meter' => 250.0,
            'fuel_percent' => 85,
            'signee_name' => 'Supervisor',
        ])
        ->assertCreated();

    expect(RentalHandoverEvidence::query()->where('rental_reservation_id', $reservation->id)->count())->toBe(2)
        ->and($job->fresh()->status)->toBe(DispatchStatus::Completed)
        ->and($attempt->fresh()->status)->toBe(DispatchAttemptStatus::Completed);
});
