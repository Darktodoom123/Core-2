<?php

use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use Database\Seeders\Development\DefenseDemoSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('seeds every lifecycle stage from Core 1 intake to approved close-out', function (): void {
    $this->seed(DefenseDemoSeeder::class);

    expect(User::query()->where('username', 'dispatcher.linking')->sole()->hasRole('operations_manager'))->toBeTrue();

    $status = fn (string $reference): DispatchStatus => DispatchJob::query()->where('reference', $reference)->sole()->status;

    expect(ServiceRequest::query()->where('reference', DefenseDemoSeeder::MARKER_REFERENCE)->sole()->status)
        ->toBe(ServiceRequestStatus::Submitted)
        ->and(DispatchJob::query()->where('reference', 'DSP-2026-0102')->sole()->assetAssignments()->count())->toBe(0)
        ->and($status('DSP-2026-0102'))->toBe(DispatchStatus::Draft)
        ->and($status('DSP-2026-0103'))->toBe(DispatchStatus::Draft)
        ->and($status('DSP-2026-0104'))->toBe(DispatchStatus::Dispatched)
        ->and($status('DSP-2026-0105'))->toBe(DispatchStatus::Working)
        ->and($status('DSP-2026-0106'))->toBe(DispatchStatus::Working)
        ->and($status('DSP-2026-0107'))->toBe(DispatchStatus::Completed);

    $priorityJob = DispatchJob::query()->where('reference', 'DSP-2026-0103')->sole();
    expect(ApprovalRequest::query()->where('subject_id', $priorityJob->id)->sole()->status)->toBe(ApprovalStatus::Pending);

    $working = DispatchJob::query()->where('reference', 'DSP-2026-0105')->sole();
    expect(FuelRequest::query()->where('dispatch_job_id', $working->id)->sole()->status)->toBe(FuelRequestStatus::Forwarded);

    expect(DispatchJob::query()->where('reference', 'DSP-2026-0106')->sole()->reports()->sole()->status)->toBe(JobReportStatus::Submitted)
        ->and(DispatchJob::query()->where('reference', 'DSP-2026-0107')->sole()->reports()->sole()->status)->toBe(JobReportStatus::Approved);

    // Re-running is a no-op instead of a duplicate-key failure.
    $this->seed(DefenseDemoSeeder::class);
    expect(ServiceRequest::query()->count())->toBe(7);
});

it('puts the local quick-login operator on the field-app acceptance stage when that account exists', function (): void {
    $this->seed(RolePermissionSeeder::class);
    $operator = User::factory()->create(['username' => 'operator', 'email' => 'operator@example.com', 'is_active' => true]);
    $operator->syncRoles(['crane_operator']);
    $operator->personnelCredentials()->create([
        'kind' => 'operator_certification', 'credential_number' => 'OP-LOCAL', 'credential_type' => 'TESDA NC II',
        'status' => 'active', 'issued_at' => now()->subYear(), 'expires_at' => now()->addYear(),
    ]);

    $this->seed(DefenseDemoSeeder::class);

    $job = DispatchJob::query()->where('reference', 'DSP-2026-0104')->sole();
    expect($job->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->personnelAssignments()->where('assignment_type', 'crane_operator')->sole()->user_id)->toBe($operator->id);
});
