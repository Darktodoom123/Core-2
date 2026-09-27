<?php

namespace App\Modules\Assignment\Actions;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Models\UnitLink;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Binds an operator standing at a unit to it. Only one operator holds a unit
 * and an operator holds one unit at a time; a second claim is refused so
 * dispatch sorts it out (mobile lifecycle v1.1, 4.2 Conflicting Unit Claims).
 */
final class LinkUnit
{
    /** Approved jobs an operator can be on site for; the phone shows these as live. */
    private const LIVE_JOB_STATUSES = [
        DispatchStatus::Scheduled,
        DispatchStatus::Dispatched,
        DispatchStatus::Accepted,
        DispatchStatus::EnRoute,
        DispatchStatus::Arrived,
        DispatchStatus::Working,
    ];

    /** A unit in these states is locked out and cannot be linked. */
    private const LOCKED_OUT_STATUSES = [
        AssetStatus::UnderMaintenance,
        AssetStatus::AwaitingParts,
        AssetStatus::Unavailable,
    ];

    public function __construct(private readonly RecordAuditEvent $audit) {}

    /**
     * @return array{link: UnitLink, created: bool}
     */
    public function handle(User $actor, OperationalAsset $asset, ?int $dispatchJobId = null): array
    {
        $job = $this->assignedJob($actor, $asset, $dispatchJobId);

        // 422, not 403: the operator may use this endpoint, the unit just isn't theirs.
        abort_if(
            $job === null,
            422,
            "You are not assigned to {$asset->code}. Contact dispatch.",
        );

        return DB::transaction(function () use ($actor, $asset, $job): array {
            // Same order as shift actions: operator, then unit, then links.
            User::query()->whereKey($actor->id)->lockForUpdate()->first();

            /** @var OperationalAsset $lockedAsset */
            $lockedAsset = OperationalAsset::query()->whereKey($asset->id)->lockForUpdate()->firstOrFail();

            abort_if(
                in_array($lockedAsset->status, self::LOCKED_OUT_STATUSES, true),
                422,
                "{$lockedAsset->code} is out of service ({$lockedAsset->status->label()}). Contact dispatch.",
            );

            /** @var UnitLink|null $unitHolder */
            $unitHolder = UnitLink::query()->open()
                ->where('operational_asset_id', $lockedAsset->id)
                ->with('user')
                ->lockForUpdate()
                ->first();

            if ($unitHolder !== null && $unitHolder->user_id === $actor->id) {
                return ['link' => $unitHolder, 'created' => false];
            }

            abort_if(
                $unitHolder !== null,
                409,
                "Unit {$lockedAsset->code} is actively bound to {$unitHolder?->user->name}. Contact dispatch.",
            );

            /** @var UnitLink|null $otherUnit */
            $otherUnit = UnitLink::query()->open()
                ->where('user_id', $actor->id)
                ->with('asset')
                ->lockForUpdate()
                ->first();

            abort_if(
                $otherUnit !== null,
                409,
                "Release {$otherUnit?->asset->code} before linking {$lockedAsset->code}.",
            );

            /** @var UnitLink $link */
            $link = UnitLink::query()->create([
                'operational_asset_id' => $lockedAsset->id,
                'user_id' => $actor->id,
                'dispatch_job_id' => $job->id,
                'linked_at' => now(),
            ]);

            $this->audit->handle(
                $actor,
                $lockedAsset,
                'fleet.unit_linked',
                null,
                ['operator_id' => $actor->id, 'dispatch_job_id' => $job->id],
                'Operator confirmed on site and linked the unit.',
            );

            return ['link' => $link, 'created' => true];
        });
    }

    /** A live job where the operator accepted the work and the unit is assigned. */
    private function assignedJob(User $actor, OperationalAsset $asset, ?int $dispatchJobId): ?DispatchJob
    {
        /** @var DispatchJob|null */
        return DispatchJob::query()
            ->when($dispatchJobId !== null, fn (Builder $query) => $query->whereKey($dispatchJobId))
            ->whereIn('status', self::LIVE_JOB_STATUSES)
            ->whereIn('id', DispatchPersonnelAssignment::query()
                ->open()
                ->where('user_id', $actor->id)
                ->where('response_status', AssignmentResponse::Accepted)
                ->select('dispatch_job_id'))
            ->whereIn('id', DispatchAssetAssignment::query()
                ->open()
                ->where('operational_asset_id', $asset->id)
                ->select('dispatch_job_id'))
            ->orderBy('id')
            ->first();
    }
}
