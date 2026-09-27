<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('terminal dispatch projections expose only recorded outcome timestamps and reasons', function (): void {
    $manager = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-OUTCOME-1',
        'client' => 'Test client',
        'title' => 'Recorded outcome',
        'site' => 'Batangas',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $manager->id,
        'version' => 1,
    ]);

    $job->status = DispatchStatus::Completed;
    $job->save();
    $completed = OperationsWorkspaceViewModel::job($job->fresh());

    expect($completed['completed_at'])->not->toBeNull()
        ->and($completed['cancelled_at'])->toBeNull();

    $job->forceFill([
        'status' => DispatchStatus::Cancelled,
        'completed_at' => null,
        'cancelled_at' => null,
        'cancellation_reason' => 'Customer cancelled before mobilisation',
    ])->saveQuietly();
    $cancelled = OperationsWorkspaceViewModel::job($job->fresh());

    expect($cancelled['completed_at'])->toBeNull()
        ->and($cancelled['cancelled_at'])->toBeNull()
        ->and($cancelled['cancellation_reason'])->toBe('Customer cancelled before mobilisation');
});
