<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function advUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

describe('Empirical Challenger: 5-Stage State Machine & Factual Truth Invariants', function () {
    test('fuel state machine strictly rejects logging an approved request before it is verified', function () {
        $driver = advUser(RoleName::CraneOperator);
        $dispatcher = advUser(RoleName::OperationsManager);
        $manager = advUser(RoleName::OperationsManager);

        $asset = OperationalAsset::query()->create([
            'code' => 'CRN-ADV-01',
            'name' => 'Adversarial Crane',
            'kind' => 'crane',
            'subtype' => 'all-terrain',
            'status' => AssetStatus::ReadyForService,
            'meter_type' => 'hour_meter',
            'meter_value' => 500.0,
        ]);

        // 1. Submit
        $this->actingAs($driver)->post('/operations/fuel-requests', [
            'quantity_litres' => 150,
            'fuel_type' => 'diesel',
            'purpose' => 'Heavy lift foundation',
            'operational_asset_id' => $asset->id,
        ])->assertRedirect('/');

        $fuel = FuelRequest::query()->sole();
        expect($fuel->status)->toBe(FuelRequestStatus::Submitted);

        // 2. Forward
        $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'forwarded',
        ])->assertRedirect('/');

        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Forwarded);

        // 3. Approve
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'approved',
            'reason' => 'Approved by manager',
        ])->assertRedirect('/');

        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Approved);

        // 4. ADVERSARIAL ATTEMPT: Attempt to record fuel log directly from "approved" (bypassing "verified")
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 150,
            'hour_meter' => 510.0,
            'price_per_litre' => 65.0,
            'total_cost' => 9750.0,
        ])->assertSessionHasErrors('status');

        // Verify status remains strictly Approved
        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Approved)
            ->and(FuelLog::query()->where('fuel_request_id', $fuel->id)->exists())->toBeFalse();

        // 5. Verify the request
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'verified',
        ])->assertRedirect('/');

        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Verified);

        // 6. Now logging from verified SUCCEEDS
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 150,
            'hour_meter' => 510.0,
            'price_per_litre' => 65.0,
            'total_cost' => 9750.0,
        ])->assertRedirect('/');

        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Logged)
            ->and(FuelLog::query()->where('fuel_request_id', $fuel->id)->exists())->toBeTrue();
    });

    test('self-review is strictly blocked via HTTP 403 when actor is requester even with manager privileges', function () {
        // Manager user who is also a driver/operator (requester + manager)
        $managerRequester = advUser(RoleName::OperationsManager);
        $managerRequester->assignRole(RoleName::CraneOperator->value);
        $independentManager = advUser(RoleName::OperationsManager);

        // Manager submits fuel request
        $this->actingAs($managerRequester)->post('/operations/fuel-requests', [
            'quantity_litres' => 200,
            'fuel_type' => 'diesel',
            'purpose' => 'Requester is manager test',
        ])->assertRedirect('/');

        $fuel = FuelRequest::query()->sole();

        // Forward
        $this->actingAs($independentManager)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'forwarded',
        ])->assertRedirect('/');

        // Requester attempts to approve own request -> MUST be 403 Forbidden
        $this->actingAs($managerRequester)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'approved',
            'reason' => 'I approve my own request',
        ])->assertForbidden();

        // Requester attempts to reject own request -> MUST be 403 Forbidden
        $this->actingAs($managerRequester)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'rejected',
            'reason' => 'I reject my own request',
        ])->assertForbidden();

        // Independent manager can approve
        $this->actingAs($independentManager)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'approved',
            'reason' => 'Independent manager approves',
        ])->assertRedirect('/');

        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Approved)
            ->and($fuel->approved_by)->toBe($independentManager->id);
    });

    test('job report author cannot self-review or self-approve own report', function () {
        $managerAuthor = advUser(RoleName::OperationsManager);
        $independentManager = advUser(RoleName::OperationsManager);

        $job = DispatchJob::query()->create([
            'reference' => 'DSP-ADV-REPORT',
            'client' => 'Client X',
            'title' => 'Report Title',
            'site' => 'Site X',
            'status' => DispatchStatus::Working,
            'priority' => DispatchPriority::Routine,
            'scheduled_start' => now()->subHour(),
            'scheduled_end' => now()->addHours(2),
            'created_by' => $managerAuthor->id,
            'version' => 1,
        ]);

        $report = JobReport::query()->create([
            'dispatch_job_id' => $job->id,
            'author_id' => $managerAuthor->id,
            'started_at' => now()->subHour(),
            'ended_at' => now(),
            'work_summary' => 'Manager executed report',
            'status' => JobReportStatus::Submitted,
            'submitted_at' => now(),
        ]);

        // Author manager attempts self-review -> 403
        $this->actingAs($managerAuthor)->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])->assertStatus(403);

        // Independent manager approves -> 302
        $this->actingAs($independentManager)->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])->assertRedirect('/');

        $report->refresh();
        expect($report->status)->toBe(JobReportStatus::Approved);
    });

    test('state machine rejects all invalid jumps across every lifecycle stage', function () {
        $driver = advUser(RoleName::CraneOperator);
        $dispatcher = advUser(RoleName::OperationsManager);
        $manager = advUser(RoleName::OperationsManager);

        $this->actingAs($driver)->post('/operations/fuel-requests', [
            'quantity_litres' => 100,
            'fuel_type' => 'diesel',
            'purpose' => 'Invalid jump matrix test',
        ])->assertRedirect('/');

        $fuel = FuelRequest::query()->sole();

        // From SUBMITTED:
        // Attempt jump to: approved (fail), verified (fail), logged (fail)
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'approved'])
            ->assertSessionHasErrors('status');
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified'])
            ->assertSessionHasErrors('status');
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'logged'])
            ->assertSessionHasErrors('status');

        // Transition to FORWARDED
        $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'forwarded'])
            ->assertRedirect('/');
        $fuel->refresh();

        // From FORWARDED:
        // Attempt jump to: verified (fail), logged (fail), submitted (fail)
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified'])
            ->assertSessionHasErrors('status');
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'logged'])
            ->assertSessionHasErrors('status');

        // Transition to APPROVED
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'approved',
            'reason' => 'Approved properly',
        ])->assertRedirect('/');
        $fuel->refresh();

        // From APPROVED:
        // Attempt jump to: logged directly (fail), forwarded (fail), submitted (fail)
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 100,
        ])->assertSessionHasErrors('status');

        // Transition to VERIFIED
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified'])
            ->assertRedirect('/');
        $fuel->refresh();

        // From VERIFIED:
        // Attempt jump to: approved (fail), forwarded (fail), submitted (fail)
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'approved'])
            ->assertSessionHasErrors('status');

        // Transition to LOGGED
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 100,
        ])->assertRedirect('/');
        $fuel->refresh();
        expect($fuel->status)->toBe(FuelRequestStatus::Logged);

        // From LOGGED:
        // Attempt any transition: logged again (duplicate log fail), verified (fail), approved (fail)
        $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
            'status' => 'logged',
            'quantity_litres' => 100,
        ])->assertSessionHasErrors('status');
        $this->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified'])
            ->assertSessionHasErrors('status');
    });
});
