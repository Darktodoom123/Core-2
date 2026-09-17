<?php

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Sales\Enums\SalesFulfillmentMode;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesDeliveryEvidence;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
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

function createSalesTestEntities(): array
{
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $operatorToken = $operator->createToken('Mobile Operator Token')->plainTextToken;

    $client = Client::query()->create([
        'code' => 'CLI-SALES-'.Str::random(4),
        'company_name' => 'San Miguel Infrastructure Corp.',
        'status' => 'active',
    ]);

    $order = SalesOrder::query()->create([
        'reference' => 'SO-TEST-'.Str::random(6),
        'client_id' => $client->id,
        'created_by' => $manager->id,
        'status' => SalesOrderStatus::Confirmed,
        'fulfillment_mode' => SalesFulfillmentMode::Delivery,
        'delivery_location' => 'NSCR Depot Area, Bulacan',
        'currency' => 'PHP',
        'total_cents' => 50000000,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-SALES-'.Str::random(6),
        'client' => $client->company_name,
        'title' => 'Sales Equipment Delivery',
        'site' => 'NSCR Depot Area, Bulacan',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $manager->id,
        'source_type' => DispatchSourceType::SalesOrder->value,
        'source_id' => $order->id,
    ]);

    $order->update(['dispatch_job_id' => $job->id]);

    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'legacy_dispatch_job_id' => $job->id,
        'source_type' => DispatchSourceType::SalesOrder->value,
        'source_id' => $order->id,
        'source_reference' => $order->reference,
        'external_reference' => $order->reference,
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
        'order' => $order,
        'job' => $job,
        'attempt' => $attempt,
    ];
}

it('records sales delivery evidence, completes linked dispatch attempt, and satisfies idempotency', function (): void {
    ['operatorToken' => $token, 'order' => $order, 'job' => $job, 'attempt' => $attempt] = createSalesTestEntities();

    $commandId = (string) Str::uuid();
    $mockSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    $mockPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    $payload = [
        'verified_vin' => 'CAT0320GC88912',
        'accessories_checked' => ['bucket', 'coupler', 'toolkit', 'manual'],
        'delivery_notes' => 'Unit unloaded safely at crane pad; operations manual handed over.',
        'signee_name' => 'Engr. Rafael Mendoza',
        'signee_role' => 'Authorized Receiving Engineer',
        'signature_base64' => $mockSignature,
        'photos' => [
            [
                'base64' => $mockPhoto,
                'label' => 'Delivered Excavator Front View',
            ],
        ],
        'command_id' => $commandId,
    ];

    $response = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $payload)
        ->assertCreated();

    expect($response->json('message'))->toBe('Sales delivery evidence recorded successfully.')
        ->and($response->json('data.verified_vin'))->toBe('CAT0320GC88912')
        ->and($response->json('data.signee_name'))->toBe('Engr. Rafael Mendoza')
        ->and($response->json('data.signee_role'))->toBe('Authorized Receiving Engineer')
        ->and($response->json('data.accessories_checked'))->toEqual(['bucket', 'coupler', 'toolkit', 'manual']);

    $evidence = SalesDeliveryEvidence::query()->where('sales_order_id', $order->id)->sole();
    expect($evidence->verified_vin)->toBe('CAT0320GC88912')
        ->and($evidence->accessories_checked)->toEqual(['bucket', 'coupler', 'toolkit', 'manual'])
        ->and($evidence->signature_path)->not->toBeNull()
        ->and(count($evidence->photos))->toBe(1);

    // Linked dispatch job and attempt completed
    expect($job->fresh()->status)->toBe(DispatchStatus::Completed)
        ->and($attempt->fresh()->status)->toBe(DispatchAttemptStatus::Completed);

    // Sales order status remains Confirmed (managerial fulfillment action required)
    expect($order->fresh()->status)->toBe(SalesOrderStatus::Confirmed);

    // Idempotent replay with same command_id succeeds
    $replayResponse = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $payload)
        ->assertCreated();

    expect($replayResponse->json('data.id'))->toBe($response->json('data.id'));

    // Conflicting payload is rejected with 422
    $conflictingPayload = array_merge($payload, ['verified_vin' => 'WRONG-VIN']);
    $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $conflictingPayload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('command_id');
});

it('rejects unauthenticated requests to submit sales delivery evidence', function (): void {
    ['order' => $order] = createSalesTestEntities();

    $this->postJson("/api/v1/sales-orders/{$order->id}/delivery", [
        'verified_vin' => 'VIN-123',
        'signee_name' => 'John Doe',
        'signee_role' => 'Manager',
    ])->assertUnauthorized();
});

it('rejects unauthorized users from submitting sales delivery evidence', function (): void {
    ['order' => $order] = createSalesTestEntities();

    $unauthorizedUser = User::factory()->create(['is_active' => true]);
    $token = $unauthorizedUser->createToken('Unauthorized Token')->plainTextToken;

    $this->withToken($token)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", [
            'verified_vin' => 'CAT0320GC88912',
            'signee_name' => 'Intruder',
            'signee_role' => 'Unknown',
        ])
        ->assertForbidden();
});

it('validates required fields on sales delivery submission', function (): void {
    ['operatorToken' => $token, 'order' => $order] = createSalesTestEntities();

    $this->withToken($token)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", [
            'delivery_notes' => 'Notes without required VIN or signee details',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['verified_vin', 'signee_name', 'signee_role']);
});

it('safely ignores non-image attachment payloads without storing files to disk', function (): void {
    ['operatorToken' => $token, 'order' => $order] = createSalesTestEntities();

    $payload = [
        'verified_vin' => 'CAT0320GC88912',
        'signee_name' => 'Engr. Rafael Mendoza',
        'signee_role' => 'Authorized Receiving Engineer',
        'signature_base64' => 'data:image/png;base64,'.base64_encode('plain text payload'),
        'photos' => [
            [
                'base64' => 'data:image/jpeg;base64,'.base64_encode('plain text payload'),
                'label' => 'Fake Photo',
            ],
        ],
    ];

    $this->withToken($token)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $payload)
        ->assertCreated();

    $evidence = SalesDeliveryEvidence::query()->where('sales_order_id', $order->id)->sole();
    expect($evidence->signature_path)->toBeNull()
        ->and($evidence->photos)->toBeEmpty();

    expect(Storage::disk('public')->allFiles('sales_evidence'))->toBeEmpty();
});

it('compensates and removes staged storage files if database transaction fails', function (): void {
    ['operatorToken' => $token, 'order' => $order] = createSalesTestEntities();

    SalesDeliveryEvidence::saving(function (): void {
        throw new RuntimeException('Simulated database write failure during sales delivery');
    });

    $validBase64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    $payload = [
        'verified_vin' => 'CAT0320GC88912',
        'signee_name' => 'Engr. Rafael Mendoza',
        'signee_role' => 'Authorized Receiving Engineer',
        'signature_base64' => $validBase64Png,
        'photos' => [
            [
                'base64' => $validBase64Png,
                'label' => 'Delivered Excavator Front View',
            ],
        ],
    ];

    $this->withToken($token)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $payload)
        ->assertStatus(500);

    expect(Storage::disk('public')->allFiles('sales_evidence'))->toBeEmpty();
});

it('binds evidence explicitly to selected job when operator has multiple matching assignments', function (): void {
    ['operator' => $operator, 'operatorToken' => $token, 'order' => $orderA, 'job' => $jobA, 'attempt' => $attemptA] = createSalesTestEntities();

    $manager = User::query()->where('email', '!=', $operator->email)->first();
    $client = Client::query()->first();

    $orderB = SalesOrder::query()->create([
        'reference' => 'SO-TEST-'.Str::random(6),
        'client_id' => $client->id,
        'created_by' => $manager->id,
        'status' => SalesOrderStatus::Confirmed,
        'fulfillment_mode' => SalesFulfillmentMode::Delivery,
        'delivery_location' => 'Cavite Port Area',
        'currency' => 'PHP',
        'total_cents' => 80000000,
    ]);

    $jobB = DispatchJob::query()->create([
        'reference' => 'DISP-SALES-'.Str::random(6),
        'client' => $client->company_name,
        'title' => 'Second Sales Delivery Dispatch',
        'site' => 'Cavite Port Area',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $manager->id,
        'source_type' => DispatchSourceType::SalesOrder->value,
        'source_id' => $orderB->id,
    ]);
    $orderB->update(['dispatch_job_id' => $jobB->id]);

    $handoffB = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'legacy_dispatch_job_id' => $jobB->id,
        'source_type' => DispatchSourceType::SalesOrder->value,
        'source_id' => $orderB->id,
        'source_reference' => $orderB->reference,
        'external_reference' => $orderB->reference,
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

    $commandId = (string) Str::uuid();
    $payload = [
        'dispatch_job_id' => $jobB->id,
        'verified_vin' => 'VIN-JOB-B-8888',
        'accessories_checked' => ['spare_wheel', 'toolkit'],
        'signee_name' => 'Engr. Port Delivery In-Charge',
        'signee_role' => 'Port Receiving Engineer',
        'command_id' => $commandId,
    ];

    $response = $this->withToken($token)
        ->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/sales-orders/{$orderB->id}/delivery", $payload)
        ->assertCreated();

    expect($response->json('data.dispatch_job_id'))->toBe($jobB->id)
        ->and($response->json('data.sales_order_id'))->toBe($orderB->id)
        ->and($response->json('data.verified_vin'))->toBe('VIN-JOB-B-8888');

    // Explicitly targeted Job B and Attempt B are completed
    expect($jobB->fresh()->status)->toBe(DispatchStatus::Completed)
        ->and($attemptB->fresh()->status)->toBe(DispatchAttemptStatus::Completed);

    // Job A and Attempt A remain in original Working status
    expect($jobA->fresh()->status)->toBe(DispatchStatus::Working)
        ->and($attemptA->fresh()->status)->toBe(DispatchAttemptStatus::Working);
});

it('enforces assignment boundaries and rejects unassigned operators for sales delivery', function (): void {
    ['order' => $order] = createSalesTestEntities();

    $unassignedOperator = User::factory()->create(['is_active' => true]);
    $unassignedOperator->syncRoles([RoleName::CraneOperator->value]);
    $unassignedToken = $unassignedOperator->createToken('Unassigned Token')->plainTextToken;

    $payload = [
        'verified_vin' => 'VIN-ILLEGAL',
        'signee_name' => 'Intruder',
        'signee_role' => 'Unauthorized Person',
    ];

    $this->withToken($unassignedToken)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $payload)
        ->assertForbidden();
});

it('does not complete sales dispatch attempt if attempt is not in working or arrived status', function (): void {
    ['operatorToken' => $token, 'order' => $order, 'job' => $job, 'attempt' => $attempt] = createSalesTestEntities();

    $job->update(['status' => DispatchStatus::Scheduled]);
    $attempt->update(['status' => DispatchAttemptStatus::Draft]);

    $payload = [
        'verified_vin' => 'VIN-SCHED-123',
        'signee_name' => 'Receiving Engineer',
        'signee_role' => 'Site Receiver',
    ];

    $this->withToken($token)
        ->postJson("/api/v1/sales-orders/{$order->id}/delivery", $payload)
        ->assertCreated();

    // Job and attempt remain in Scheduled / Draft
    expect($job->fresh()->status)->toBe(DispatchStatus::Scheduled)
        ->and($attempt->fresh()->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($order->fresh()->status)->toBe(SalesOrderStatus::Confirmed);
});
