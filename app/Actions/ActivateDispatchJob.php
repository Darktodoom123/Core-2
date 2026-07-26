<?php

namespace App\Actions;

use App\Enums\ApprovalStatus;
use App\Enums\DispatchStatus;
use App\Models\DispatchJob;
use App\Models\MaintenanceWorkOrder;
use App\Models\OperationalAsset;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class ActivateDispatchJob
{
    public function __construct(private RecordAuditEvent $audit) {}

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

            $personnelAssignments = $job->personnelAssignments()
                ->whereNull('active_until')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $assetIds = $job->assetAssignments()
                ->whereNull('active_until')
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('operational_asset_id')
                ->map(static fn (mixed $assetId): int => (int) $assetId)
                ->all();

            if ($personnelAssignments->isEmpty()) {
                throw ValidationException::withMessages(['personnel' => 'Assign at least one active field worker before activation.']);
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
                            ? 'The latest exceptional request was rejected. Revise the dispatch and request a new independent review.'
                            : 'Operations Manager approval is required before activation.',
                    ]);
                }
            }

            $assets = OperationalAsset::query()
                ->withTrashed()
                ->whereIn('id', $assetIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $blockedAssetIds = MaintenanceWorkOrder::query()
                ->whereIn('operational_asset_id', $assetIds)
                ->where('dispatch_blocking', true)
                ->whereNull('released_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('operational_asset_id')
                ->map(static fn (mixed $assetId): int => (int) $assetId)
                ->all();

            foreach ($assetIds as $assetId) {
                $asset = $assets->get($assetId);

                if (! $asset instanceof OperationalAsset
                    || $asset->trashed()
                    || ! $asset->status->dispatchable()
                    || in_array($assetId, $blockedAssetIds, true)) {
                    $code = $asset instanceof OperationalAsset ? $asset->code : "Asset #{$assetId}";

                    throw ValidationException::withMessages(['assets' => "{$code} is not safe for dispatch."]);
                }
            }

            $before = $job->only(['status', 'version']);
            $job->update(['status' => DispatchStatus::Dispatched, 'activated_by' => $actor->id, 'version' => $job->version + 1]);
            $this->audit->handle($actor, $job, 'dispatch.activated', $before, $job->only(['status', 'version']));

            return $job->refresh();
        });
    }
}
