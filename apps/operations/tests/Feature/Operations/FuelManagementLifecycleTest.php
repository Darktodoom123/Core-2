<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Models\Notification;
use App\Platform\Workspace\Queries\WorkspaceFuelRequestsQuery;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

function fuelLifecycleOperator(): User
{
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo(['fuel.request', 'fuel.view_own', 'fuel.record']);

    return $user;
}

function fuelLifecycleManager(): User
{
    $user = User::factory()->create(['is_active' => true]);
    $user->givePermissionTo(['fuel.view_all', 'fuel.forward', 'fuel.approve', 'fuel.verify']);

    return $user;
}

/** @return array{0: OperationalAsset, 1: DispatchJob} */
function fuelLifecycleAssignment(User $operator, string $suffix = 'A'): array
{
    $asset = OperationalAsset::create(['code' => "FL-CRN-{$suffix}", 'name' => "Crane {$suffix}", 'kind' => 'crane', 'subtype' => 'mobile', 'status' => 'ready_for_service']);
    $job = DispatchJob::create(['reference' => "FL-JOB-{$suffix}", 'client' => 'Client', 'title' => 'Lift', 'site' => 'Site', 'status' => 'draft', 'priority' => 'routine', 'scheduled_start' => now(), 'scheduled_end' => now()->addHour(), 'created_by' => $operator->id, 'version' => 1]);
    DispatchPersonnelAssignment::create(['dispatch_job_id' => $job->id, 'user_id' => $operator->id, 'assignment_type' => 'operator', 'assigned_by' => $operator->id, 'active_from' => now()->subHour()]);
    DispatchAssetAssignment::create(['dispatch_job_id' => $job->id, 'operational_asset_id' => $asset->id, 'assignment_type' => 'primary', 'assigned_by' => $operator->id, 'active_from' => now()->subHour()]);

    return [$asset, $job];
}

/** @param array<string, mixed> $overrides */
function fuelLifecyclePayload(array $overrides = []): array
{
    return ['client_request_id' => (string) Str::uuid(), 'quantity_litres' => 80, 'fuel_type' => 'diesel', 'purpose' => 'Afternoon lift', ...$overrides];
}

function fuelLifecycleRequest(User $requester, FuelRequestStatus $status = FuelRequestStatus::Submitted): FuelRequest
{
    return FuelRequest::create([
        'reference' => 'FUEL-'.Str::upper(Str::random(8)),
        'requester_id' => $requester->id,
        'quantity_litres' => 60,
        'fuel_type' => 'diesel',
        'purpose' => 'Field operation',
        'status' => $status,
    ]);
}

it('defaults mobile fuel options to the operators active shift unit and job', function (): void {
    $operator = fuelLifecycleOperator();
    [$assetA] = fuelLifecycleAssignment($operator, 'A');
    [$assetB, $jobB] = fuelLifecycleAssignment($operator, 'B');
    OperatorShift::create(['user_id' => $operator->id, 'operational_asset_id' => $assetB->id, 'dispatch_job_id' => $jobB->id, 'status' => ShiftStatus::ACTIVE, 'started_at' => now()->subHour()]);

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->getJson('/api/v1/fuel-options')
        ->assertOk()
        ->assertJsonPath('data.defaults.operational_asset_id', $assetB->id)
        ->assertJsonPath('data.defaults.dispatch_job_id', $jobB->id);

    expect($assetA->id)->not->toBe($assetB->id);
});

it('defaults to the only assigned unit when no shift is active', function (): void {
    $operator = fuelLifecycleOperator();
    [$asset, $job] = fuelLifecycleAssignment($operator);

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->getJson('/api/v1/fuel-options')
        ->assertOk()
        ->assertJsonPath('data.defaults.operational_asset_id', $asset->id)
        ->assertJsonPath('data.defaults.dispatch_job_id', $job->id);
});

it('stores urgency, needed-by and tank level on a mobile request', function (): void {
    $operator = fuelLifecycleOperator();
    $neededBy = now()->addHours(2)->startOfMinute();

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->postJson('/api/v1/fuel-requests', fuelLifecyclePayload([
            'urgency' => 'critical',
            'needed_by' => $neededBy->toIso8601String(),
            'current_fuel_level_percent' => 10,
        ]))
        ->assertCreated()
        ->assertJsonPath('data.urgency', 'critical')
        ->assertJsonPath('data.current_fuel_level_percent', 10)
        ->assertJsonPath('data.can_withdraw', true);

    $fuel = FuelRequest::sole();
    expect($fuel->urgency)->toBe('critical')
        ->and($fuel->needed_by?->equalTo($neededBy))->toBeTrue()
        ->and($fuel->current_fuel_level_percent)->toBe(10);
});

it('defaults urgency to normal and rejects invalid urgency and tank level', function (): void {
    $operator = fuelLifecycleOperator();
    $this->withToken($operator->createToken('mobile')->plainTextToken);

    $this->postJson('/api/v1/fuel-requests', fuelLifecyclePayload(['urgency' => 'whenever', 'current_fuel_level_percent' => 140]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['urgency', 'current_fuel_level_percent']);

    $this->postJson('/api/v1/fuel-requests', fuelLifecyclePayload())
        ->assertCreated()
        ->assertJsonPath('data.urgency', 'normal');
});

it('lets a manager approve a submitted request in one review step with both stages audited', function (): void {
    $operator = fuelLifecycleOperator();
    $manager = fuelLifecycleManager();
    $fuel = fuelLifecycleRequest($operator);

    $this->actingAs($manager)
        ->post("/operations/fuel-requests/{$fuel->id}/review", ['decision' => 'approved', 'reason' => 'Stock available'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Approved)
        ->and($fuel->reviewed_by)->toBe($manager->id)
        ->and($fuel->approved_by)->toBe($manager->id)
        ->and($fuel->decision_reason)->toBe('Stock available');

    $statuses = AuditEvent::query()
        ->where('subject_type', $fuel->getMorphClass())
        ->where('action', 'fuel.status_updated')
        ->orderBy('id')
        ->get()
        ->map(fn (AuditEvent $event): mixed => $event->after['status'] ?? null)
        ->all();
    expect($statuses)->toBe(['forwarded', 'approved']);
});

it('requires a reason to reject and blocks self review', function (): void {
    $manager = fuelLifecycleManager();
    $manager->givePermissionTo('fuel.request');
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator);

    $this->actingAs($manager)
        ->post("/operations/fuel-requests/{$fuel->id}/review", ['decision' => 'rejected'])
        ->assertSessionHasErrors('reason');
    expect($fuel->refresh()->status)->toBe(FuelRequestStatus::Submitted);

    $this->actingAs($manager)
        ->post("/operations/fuel-requests/{$fuel->id}/review", ['decision' => 'rejected', 'reason' => 'Tank reading does not support this volume'])
        ->assertSessionHasNoErrors();
    expect($fuel->refresh()->status)->toBe(FuelRequestStatus::Rejected);

    $own = fuelLifecycleRequest($manager);
    $this->actingAs($manager)
        ->post("/operations/fuel-requests/{$own->id}/review", ['decision' => 'approved'])
        ->assertForbidden();
    expect($own->refresh()->status)->toBe(FuelRequestStatus::Submitted);
});

it('forbids review without approval permission and rejects already decided requests', function (): void {
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator);

    $this->actingAs($operator)
        ->post("/operations/fuel-requests/{$fuel->id}/review", ['decision' => 'approved'])
        ->assertForbidden();

    $approved = fuelLifecycleRequest($operator, FuelRequestStatus::Approved);
    $this->actingAs(fuelLifecycleManager())
        ->post("/operations/fuel-requests/{$approved->id}/review", ['decision' => 'approved'])
        ->assertSessionHasErrors('status');
});

it('lets the requester withdraw before approval through the idempotent mobile api', function (): void {
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator);
    $commandId = (string) Str::uuid();
    $this->withToken($operator->createToken('mobile')->plainTextToken);

    $this->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/fuel-requests/{$fuel->id}/withdraw", ['reason' => 'Refuelled from site bowser'])
        ->assertOk()
        ->assertJsonPath('data.status', 'withdrawn')
        ->assertJsonPath('data.can_withdraw', false);

    $this->withHeader('X-Command-Id', $commandId)
        ->postJson("/api/v1/fuel-requests/{$fuel->id}/withdraw", ['reason' => 'Refuelled from site bowser'])
        ->assertOk()
        ->assertJsonPath('data.status', 'withdrawn');

    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Withdrawn)
        ->and($fuel->withdrawn_at)->not->toBeNull()
        ->and($fuel->withdrawal_reason)->toBe('Refuelled from site bowser');
});

it('blocks withdrawal after approval and by anyone other than the requester', function (): void {
    $operator = fuelLifecycleOperator();
    $other = fuelLifecycleOperator();
    $approved = fuelLifecycleRequest($operator, FuelRequestStatus::Approved);
    $submitted = fuelLifecycleRequest($operator);

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->postJson("/api/v1/fuel-requests/{$approved->id}/withdraw")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('status');

    $this->app['auth']->forgetGuards();
    $this->withToken($other->createToken('mobile')->plainTextToken)
        ->postJson("/api/v1/fuel-requests/{$submitted->id}/withdraw")
        ->assertNotFound();

    $this->actingAs(fuelLifecycleManager())
        ->post("/operations/fuel-requests/{$submitted->id}/withdraw")
        ->assertForbidden();

    expect($submitted->refresh()->status)->toBe(FuelRequestStatus::Submitted);
});

it('does not let a withdrawn request be reviewed', function (): void {
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator);

    $this->actingAs($operator)->post("/operations/fuel-requests/{$fuel->id}/withdraw")->assertSessionHasNoErrors();

    $this->actingAs(fuelLifecycleManager())
        ->post("/operations/fuel-requests/{$fuel->id}/review", ['decision' => 'approved'])
        ->assertSessionHasErrors('status');
    expect($fuel->refresh()->status)->toBe(FuelRequestStatus::Withdrawn);
});

it('requires a receipt or a no-receipt reason to record refuelling', function (): void {
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator, FuelRequestStatus::Verified);
    $this->withToken($operator->createToken('mobile')->plainTextToken);

    $this->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 55])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('receipt');

    $this->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 55, 'no_receipt_reason' => 'other'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('no_receipt_note');

    expect($fuel->logs()->count())->toBe(0)
        ->and($fuel->refresh()->status)->toBe(FuelRequestStatus::Verified);
});

it('records a receipt number with the uploaded receipt', function (): void {
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator, FuelRequestStatus::Verified);

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->post("/api/v1/fuel-requests/{$fuel->id}/logs", [
            'quantity_litres' => 55,
            'receipt_number' => 'OR-448812',
            'receipt' => UploadedFile::fake()->image('receipt.jpg'),
        ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.logs.0.has_receipt', true)
        ->assertJsonPath('data.logs.0.receipt_number', 'OR-448812')
        ->assertJsonPath('data.logs.0.requires_receipt_review', false);
});

it('flags a no-receipt log for manager review and lets a verifier clear it', function (): void {
    $operator = fuelLifecycleOperator();
    $manager = fuelLifecycleManager();
    $fuel = fuelLifecycleRequest($operator, FuelRequestStatus::Verified);

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->postJson("/api/v1/fuel-requests/{$fuel->id}/logs", ['quantity_litres' => 55, 'no_receipt_reason' => 'on_site_bowser'])
        ->assertCreated()
        ->assertJsonPath('data.logs.0.has_receipt', false)
        ->assertJsonPath('data.logs.0.no_receipt_reason', 'on_site_bowser')
        ->assertJsonPath('data.logs.0.requires_receipt_review', true);

    $log = FuelLog::sole();

    $this->actingAs($operator)
        ->post("/operations/fuel-logs/{$log->id}/receipt-review")
        ->assertForbidden();

    $this->actingAs($manager)
        ->post("/operations/fuel-logs/{$log->id}/receipt-review", ['note' => 'Bowser sheet matched'])
        ->assertSessionHasNoErrors();

    $log->refresh();
    expect($log->receipt_reviewed_by)->toBe($manager->id)
        ->and($log->receipt_reviewed_at)->not->toBeNull();

    $this->actingAs($manager)
        ->post("/operations/fuel-logs/{$log->id}/receipt-review")
        ->assertSessionHasErrors('receipt');
});

it('enforces the receipt rule on the web log transition', function (): void {
    $operator = fuelLifecycleOperator();
    $fuel = fuelLifecycleRequest($operator, FuelRequestStatus::Verified);

    $this->actingAs($operator)
        ->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'logged', 'quantity_litres' => 40])
        ->assertSessionHasErrors('receipt');

    $this->actingAs($operator)
        ->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'logged', 'quantity_litres' => 40, 'no_receipt_reason' => 'vendor_no_receipt'])
        ->assertSessionHasNoErrors();

    expect($fuel->refresh()->status)->toBe(FuelRequestStatus::Logged);
});

it('notifies the requester when the request is approved, verified or rejected', function (): void {
    $operator = fuelLifecycleOperator();
    $manager = fuelLifecycleManager();
    $fuel = fuelLifecycleRequest($operator);
    $rejected = fuelLifecycleRequest($operator);

    $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/review", ['decision' => 'approved']);
    $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified']);
    $this->actingAs($manager)->post("/operations/fuel-requests/{$rejected->id}/review", ['decision' => 'rejected', 'reason' => 'Duplicate request']);

    $events = Notification::query()
        ->where('notifiable_id', $operator->id)
        ->get()
        ->map(fn (Notification $notification): array => [
            'event' => $notification->data['event'] ?? null,
            'status' => $notification->data['status'] ?? null,
            'fuel_request_id' => $notification->data['fuel_request_id'] ?? null,
        ])
        ->sortBy(['fuel_request_id', 'status'])
        ->values()
        ->all();

    expect($events)->toBe([
        ['event' => 'fuel.status_changed', 'status' => 'approved', 'fuel_request_id' => $fuel->id],
        ['event' => 'fuel.status_changed', 'status' => 'verified', 'fuel_request_id' => $fuel->id],
        ['event' => 'fuel.status_changed', 'status' => 'rejected', 'fuel_request_id' => $rejected->id],
    ]);

    expect(Notification::query()->where('notifiable_id', $operator->id)->whereNotNull('dispatch_job_id')->exists())->toBeFalse();
});

it('notifies fuel reviewers when a new request is submitted', function (): void {
    $operator = fuelLifecycleOperator();
    $reviewer = fuelLifecycleManager();
    $bystander = fuelLifecycleOperator();

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->postJson('/api/v1/fuel-requests', fuelLifecyclePayload(['urgency' => 'urgent']))
        ->assertCreated();

    $notification = Notification::query()->where('notifiable_id', $reviewer->id)->sole();
    expect($notification->data['event'])->toBe('fuel.submitted')
        ->and($notification->data['urgency'])->toBe('urgent');
    expect(Notification::query()->whereIn('notifiable_id', [$operator->id, $bystander->id])->exists())->toBeFalse();
});

it('stores urgency and tank level on a web request and validates them', function (): void {
    $operator = fuelLifecycleOperator();
    [$asset] = fuelLifecycleAssignment($operator);

    $this->actingAs($operator)
        ->post('/operations/fuel-requests', ['operational_asset_id' => $asset->id, 'quantity_litres' => 30, 'fuel_type' => 'diesel', 'purpose' => 'Test', 'urgency' => 'someday'])
        ->assertSessionHasErrors('urgency');

    $this->actingAs($operator)
        ->post('/operations/fuel-requests', ['operational_asset_id' => $asset->id, 'quantity_litres' => 30, 'fuel_type' => 'diesel', 'purpose' => 'Test', 'urgency' => 'urgent', 'current_fuel_level_percent' => 25])
        ->assertSessionHasNoErrors();

    $fuel = FuelRequest::sole();
    expect($fuel->urgency)->toBe('urgent')
        ->and($fuel->current_fuel_level_percent)->toBe(25);
});

it('counts and filters logs awaiting receipt review and sorts pending requests by urgency', function (): void {
    $operator = fuelLifecycleOperator();
    $manager = fuelLifecycleManager();
    $normal = fuelLifecycleRequest($operator);
    $critical = fuelLifecycleRequest($operator);
    $critical->update(['urgency' => 'critical']);
    $verified = fuelLifecycleRequest($operator, FuelRequestStatus::Verified);

    $this->withToken($operator->createToken('mobile')->plainTextToken)
        ->postJson("/api/v1/fuel-requests/{$verified->id}/logs", ['quantity_litres' => 20, 'no_receipt_reason' => 'receipt_lost'])
        ->assertCreated();

    $query = app(WorkspaceFuelRequestsQuery::class);

    expect($query->counts($manager)['receipt_review'])->toBe(1)
        ->and($query->paginate($manager, ['status' => 'receipt_review'])->getCollection()->pluck('id')->all())->toBe([$verified->id])
        ->and($query->paginate($manager, ['status' => 'pending'])->getCollection()->pluck('id')->all())->toBe([$critical->id, $normal->id]);
});
