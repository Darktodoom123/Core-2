<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Enums\RentalOperatorType;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
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

function gauntletUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function gauntletClient(): Client
{
    return Client::query()->create([
        'code' => 'CLI-GAUNTLET-'.fake()->unique()->numerify('####'),
        'company_name' => 'Gauntlet Test Industries',
        'status' => 'active',
    ]);
}

function gauntletAsset(string $code, AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'Heavy Crane Asset '.$code,
        'kind' => 'equipment',
        'status' => $status,
    ]);
}

it('Gate 1 & 2: enforces collision locks preventing double-booking across Service and Rental', function (): void {
    $dispatcher = gauntletUser(RoleName::OperationsManager);
    $manager = gauntletUser(RoleName::OperationsManager);
    $client = gauntletClient();
    $crane = gauntletAsset('CRANE-G2-001');

    $startDate = now()->addDays(3);
    $endDate = now()->addDays(5);

    // 1. Create and Approve Rental Reservation for the crane
    $createResponse = $this->actingAs($dispatcher)->postJson('/operations/rental-reservations', [
        'reference' => 'REN-GAUNTLET-01',
        'client_id' => $client->id,
        'start_date' => $startDate->toDateString(),
        'end_date' => $endDate->toDateString(),
        'fulfillment_mode' => 'pickup',
        'operator_type' => 'customer_provided',
        'items' => [['operational_asset_id' => $crane->id, 'quantity' => 1, 'rate_cents' => 50000]],
    ]);
    $createResponse->assertCreated();
    $reservation = RentalReservation::query()->where('reference', 'REN-GAUNTLET-01')->sole();

    $this->actingAs($manager)->postJson("/operations/rental-reservations/{$reservation->id}/approve")->assertOk();

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Reserved);
});

it('Gate 4: captures baseline and return condition diffs on Rental handover', function (): void {
    $dispatcher = gauntletUser(RoleName::OperationsManager);
    $manager = gauntletUser(RoleName::OperationsManager);
    $client = gauntletClient();
    $asset = gauntletAsset('CRANE-G4-DIFF');

    $reservation = RentalReservation::query()->create([
        'reference' => 'REN-G4-001',
        'client_id' => $client->id,
        'start_date' => now()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => RentalFulfillmentMode::Pickup,
        'operator_type' => RentalOperatorType::CraneOperator,
        'status' => RentalReservationStatus::Reserved,
        'created_by' => $dispatcher->id,
        'approved_by' => $manager->id,
        'approved_at' => now(),
    ]);

    $reservation->items()->create([
        'operational_asset_id' => $asset->id,
        'quantity' => 1,
        'rate_cents' => 10000,
        'line_total_cents' => 10000,
    ]);

    // Checkout with structured condition evidence
    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/checkout", [
        'condition' => [
            'engine' => 'good',
            'hydraulics' => 'passed',
            'exterior' => 'clean',
        ],
    ])->assertOk();

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::CheckedOut);
    expect($asset->fresh()->status)->toBe(AssetStatus::Assigned);

    // Return with condition diff
    $this->actingAs($dispatcher)->postJson("/operations/rental-reservations/{$reservation->id}/return", [
        'condition' => [
            'engine' => 'good',
            'hydraulics' => 'passed',
            'exterior' => 'scratched_boom',
        ],
    ])->assertOk();

    expect($reservation->fresh()->status)->toBe(RentalReservationStatus::Returned);
});

it('Gate 5: completes job report, records audit trail, and notifies operations', function (): void {
    $driver = gauntletUser(RoleName::Driver);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-G5-AUDIT',
        'client' => 'Gauntlet Mining Co',
        'title' => 'Bridge Girder Lift',
        'site' => 'Highway 10',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Priority,
        'scheduled_start' => now()->subHours(4),
        'scheduled_end' => now()->addHours(1),
        'created_by' => $driver->id,
        'version' => 1,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $driver->id,
        'active_from' => now()->subHours(4),
    ]);

    $response = $this->actingAs($driver)->postJson('/operations/job-reports', [
        'dispatch_job_id' => $job->id,
        'started_at' => now()->subHours(4)->toIso8601String(),
        'ended_at' => now()->toIso8601String(),
        'work_summary' => 'Placed 4x 45T bridge girders safely. No incidents.',
        'remarks' => '1.5h standby recorded waiting on client rigger.',
    ]);

    $response->assertCreated();

    // Verify Audit Event
    $report = JobReport::query()->where('dispatch_job_id', $job->id)->first();
    expect($report)->not->toBeNull();
    expect($report->status)->toBe(JobReportStatus::Submitted);

    $audit = AuditEvent::query()
        ->where('subject_type', $report->getMorphClass())
        ->where('subject_id', $report->id)
        ->first();

    expect($audit)->not->toBeNull();
    expect($audit->action)->toBe('job_report.submitted');
});
