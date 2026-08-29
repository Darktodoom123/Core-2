<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\WorkStoppageNotice;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ActivateDispatchJob
{
    public function __construct(
        private RecordAuditEvent $audit,
        private DispatchResourceEligibility $eligibility,
        private OperationalAssetAvailability $availability,
    ) {}

    public function handle(User $actor, DispatchJob $job, int $version): DispatchJob
    {
        $this->audit->handle(
            $actor,
            $job,
            'dispatch.activation_attempted',
            $job->only(['status', 'version']),
            ['requested_version' => $version],
        );
        Gate::forUser($actor)->authorize('activate', $job);

        return DB::transaction(function () use ($actor, $job, $version): DispatchJob {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            if ($job->version !== $version) {
                throw ValidationException::withMessages(['version' => 'This dispatch changed on another device. Refresh and review it again.']);
            }

            if (! in_array($job->status, [
                DispatchStatus::Draft,
                DispatchStatus::PendingApproval,
                DispatchStatus::Scheduled,
            ], true)) {
                throw ValidationException::withMessages(['status' => 'Only a draft, pending approval, or scheduled dispatch can be activated.']);
            }

            // 1. Statutory DOLE Work Stoppage Gate
            $activeWso = WorkStoppageNotice::query()
                ->where('is_active', true)
                ->where('project_site', $job->site)
                ->exists();

            if ($activeWso) {
                throw ValidationException::withMessages([
                    'safety' => 'Dispatch activation blocked: A statutory DOLE Work Stoppage Order is currently active for this site.',
                ]);
            }

            // 2. Critical Lift Safety Officer Authorization Gate
            $criticalLift = CriticalLiftPlan::query()
                ->where('dispatch_job_id', $job->id)
                ->orWhere(function ($q) use ($job) {
                    $q->where('project_site', $job->site)->where('risk_level', 'critical');
                })
                ->latest('id')
                ->first();

            if ($criticalLift !== null && $criticalLift->status !== 'approved') {
                throw ValidationException::withMessages([
                    'safety' => 'Dispatch activation blocked: Critical Lift Permit requires digital authorization from a Safety Officer.',
                ]);
            }

            $personnelAssignments = $job->personnelAssignments()
                ->whereNull('active_until')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $assetAssignments = $job->assetAssignments()
                ->whereNull('active_until')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $assetIds = $assetAssignments
                ->pluck('operational_asset_id')
                ->map(static fn (mixed $assetId): int => (int) $assetId)
                ->all();

            if ($personnelAssignments->isEmpty()) {
                throw ValidationException::withMessages(['personnel' => 'Assign at least one active field worker before activation.']);
            }

            $personnelAssignments->load([
                'user.roles:id,name',
                'user.personnelProfile',
                'user.personnelCredentials',
                'user.dispatchAssignments' => fn ($query) => $query
                    ->whereNull('active_until')
                    ->with('job'),
            ]);

            foreach ($personnelAssignments as $assignment) {
                $personnel = $assignment->user;

                if (! $personnel instanceof User) {
                    throw ValidationException::withMessages(['personnel' => 'One or more assigned field workers no longer exist.']);
                }

                $assessment = $this->eligibility->personnel(
                    $personnel,
                    $assignment->assignment_type,
                    $job,
                    true,
                );

                if (! $assessment['eligible']) {
                    throw ValidationException::withMessages([
                        'personnel' => "{$personnel->name} is no longer eligible for this dispatch: ".implode(' ', $assessment['reasons']),
                    ]);
                }
            }

            if ($assetIds === []) {
                throw ValidationException::withMessages(['assets' => 'Assign at least one active asset before activation.']);
            }

            if ($job->priority->requiresApproval()) {
                $latestApproval = $job->approvals()
                    ->whereIn('kind', ['dispatch_activation', 'assignment_override', 'reassignment_override'])
                    ->latest('id')
                    ->lockForUpdate()
                    ->first();

                if ($latestApproval?->status !== ApprovalStatus::Approved) {
                    throw ValidationException::withMessages([
                        'approval' => $latestApproval?->status === ApprovalStatus::Rejected
                            ? 'The latest approval request was rejected. Revise the dispatch and request a new review.'
                            : 'Operations Manager approval is required before activation.',
                    ]);
                }
            }

            $assets = $this->availability->lockAssetsForUpdate($assetIds);
            Gate::forUser($actor)->authorize('activate', $job);

            foreach ($assetAssignments as $assignment) {
                $assetId = (int) $assignment->operational_asset_id;
                $asset = $assets->get($assetId);

                if (! $asset instanceof OperationalAsset
                    || $asset->trashed()
                ) {
                    $code = $asset instanceof OperationalAsset ? $asset->code : "Asset #{$assetId}";

                    throw ValidationException::withMessages(['assets' => "{$code} is not safe for dispatch."]);
                }

                $assessment = $this->eligibility->asset(
                    $asset,
                    $assignment->assignment_type,
                    $job,
                    [],
                    true,
                );
                if (! $assessment['eligible']) {
                    throw ValidationException::withMessages([
                        'assets' => "{$asset->code} is not currently safe for dispatch: ".implode(' ', $assessment['reasons']),
                    ]);
                }
            }

            $before = $job->only(['status', 'version']);
            $job->update(['status' => DispatchStatus::Dispatched, 'activated_by' => $actor->id, 'version' => $job->version + 1]);
            $this->audit->handle($actor, $job, 'dispatch.activated', $before, $job->only(['status', 'version']));

            return $job->refresh();
        });
    }
}
