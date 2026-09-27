<?php

namespace App\Modules\Assignment\Actions;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\UnitLinkReleaseReason;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Models\UnitLink;
use App\Shared\Assets\Services\UnitLinkReleaser;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Transfers a unit from the outgoing operator to a relief operator once the
 * handover PIN (or token) checks out. A handover is cancelled after
 * MAX_WRONG_PINS wrong PINs so a four-digit PIN cannot be guessed.
 */
final class ClaimEquipmentHandover
{
    public const MAX_WRONG_PINS = 5;

    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly UnitLinkReleaser $unitLinks,
    ) {}

    /** @param array<string, mixed> $handover */
    public static function remember(array $handover, \DateTimeInterface $expiresAt): void
    {
        $jobId = $handover['dispatch_job_id'];

        Cache::put("handover:job:{$jobId}", $handover, $expiresAt);
        Cache::put("handover:token:{$handover['handover_token']}", $handover, $expiresAt);
        Cache::put("handover:pin:{$jobId}:{$handover['pin']}", $handover, $expiresAt);
        Cache::forget("handover:attempts:{$jobId}");

        if (($handover['asset_code'] ?? 'UNSPECIFIED') !== 'UNSPECIFIED') {
            Cache::put(self::assetKey((string) $handover['asset_code']), $handover, $expiresAt);
        }
    }

    /** @return array<string, mixed> */
    public function byJob(User $actor, DispatchJob $job, ?string $token, ?string $pin): array
    {
        if ($token !== null) {
            $handover = Cache::get("handover:token:{$token}");

            abort_if(
                ! is_array($handover) || (int) $handover['dispatch_job_id'] !== $job->id,
                422,
                'Handover session expired or invalid for this equipment.',
            );

            return $this->transfer($actor, $handover);
        }

        $handover = Cache::get("handover:job:{$job->id}");
        abort_unless(is_array($handover), 422, 'Handover session expired or invalid for this equipment.');

        return $this->checkPinThenTransfer($actor, $handover, (string) $pin);
    }

    /** @return array<string, mixed> */
    public function byUnit(User $actor, string $assetCode, string $pin): array
    {
        $handover = Cache::get(self::assetKey($assetCode));

        abort_unless(
            is_array($handover),
            422,
            'No handover is waiting for this unit. Ask the outgoing operator to start one.',
        );

        return $this->checkPinThenTransfer($actor, $handover, $pin);
    }

    /**
     * @param  array<string, mixed>  $handover
     * @return array<string, mixed>
     */
    private function checkPinThenTransfer(User $actor, array $handover, string $pin): array
    {
        if (! hash_equals((string) $handover['pin'], $pin)) {
            $key = "handover:attempts:{$handover['dispatch_job_id']}";
            $wrong = (int) Cache::increment($key);

            if ($wrong >= self::MAX_WRONG_PINS) {
                $this->forget($handover);
                abort(422, 'Too many wrong PINs. The handover was cancelled; ask the outgoing operator to start a new one.');
            }

            abort(422, 'That PIN is not right for this unit.');
        }

        return $this->transfer($actor, $handover);
    }

    /**
     * @param  array<string, mixed>  $handover
     * @return array<string, mixed>
     */
    private function transfer(User $actor, array $handover): array
    {
        abort_if(
            (int) $handover['outgoing_user_id'] === $actor->id,
            422,
            'Cannot claim handover from yourself. Another relief operator must claim the unit.',
        );

        return DB::transaction(function () use ($actor, $handover): array {
            /** @var DispatchJob $job */
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($handover['dispatch_job_id']);

            /** @var DispatchPersonnelAssignment|null $outgoingAssignment */
            $outgoingAssignment = $job->personnelAssignments()
                ->open()
                ->where('user_id', $handover['outgoing_user_id'])
                ->lockForUpdate()
                ->first();

            $outgoingAssignment?->update([
                'active_until' => now(),
                'notes' => 'Transferred equipment to relief operator ID '.$actor->id,
            ]);

            DispatchPersonnelAssignment::query()->create([
                'dispatch_job_id' => $job->id,
                'user_id' => $actor->id,
                'assignment_type' => $outgoingAssignment->assignment_type ?? 'driver',
                'assigned_by' => $actor->id,
                'response_status' => AssignmentResponse::Accepted,
                'responded_at' => now(),
                'created_at' => now(),
            ]);

            $job->increment('version');

            $this->transferUnitLink($actor, $job, (string) $handover['asset_code']);

            $this->audit->handle(
                $actor,
                $job,
                'dispatch.equipment_handover',
                ['previous_operator_id' => $handover['outgoing_user_id']],
                ['active_operator_id' => $actor->id],
                'Equipment hot-seat handover completed with zero telemetry drop.'
            );

            $this->forget($handover);

            return [
                'dispatch_job_id' => $job->id,
                'asset_code' => $handover['asset_code'],
                'status' => 'transferred',
                'previous_operator_id' => $handover['outgoing_user_id'],
                'active_operator_id' => $actor->id,
                'active_operator_name' => $actor->name,
            ];
        });
    }

    /** The relief operator takes over the unit's binding with no gap. */
    private function transferUnitLink(User $actor, DispatchJob $job, string $assetCode): void
    {
        /** @var OperationalAsset|null $asset */
        $asset = $job->assetAssignments()->open()
            ->whereHas('asset', fn ($query) => $query->where('code', $assetCode))
            ->with('asset')
            ->first()
            ?->asset;

        if ($asset === null) {
            return;
        }

        $this->unitLinks->forAsset($asset->id, UnitLinkReleaseReason::Handover);
        $this->unitLinks->forUser($actor->id, UnitLinkReleaseReason::Handover);

        UnitLink::query()->create([
            'operational_asset_id' => $asset->id,
            'user_id' => $actor->id,
            'dispatch_job_id' => $job->id,
            'linked_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $handover */
    private function forget(array $handover): void
    {
        $jobId = $handover['dispatch_job_id'];

        Cache::forget("handover:job:{$jobId}");
        Cache::forget('handover:token:'.$handover['handover_token']);
        Cache::forget("handover:pin:{$jobId}:".$handover['pin']);
        Cache::forget("handover:attempts:{$jobId}");
        Cache::forget(self::assetKey((string) $handover['asset_code']));
    }

    private static function assetKey(string $assetCode): string
    {
        return 'handover:asset:'.Str::upper(trim($assetCode));
    }
}
