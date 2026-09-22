<?php

namespace App\Modules\HoursOfService\Actions;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Modules\HoursOfService\Services\DutyLocationSnapshotService;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StartOperatorShiftAction
{
    public function __construct(
        private readonly DutyLocationSnapshotService $locationSnapshotService,
    ) {}

    public function execute(
        User $user,
        ?int $operationalAssetId = null,
        ?int $dispatchJobId = null,
        DutyStatus $initialDutyStatus = DutyStatus::OPERATING,
        ?float $latitude = null,
        ?float $longitude = null,
        ?float $accuracyMetres = null,
        ?CarbonInterface $locationObservedAt = null,
        ?string $locationSource = null,
        ?string $locationName = null,
        ?string $remarks = null,
        ?CarbonInterface $occurredAt = null,
    ): OperatorShift {
        return DB::transaction(function () use (
            $user,
            $operationalAssetId,
            $dispatchJobId,
            $initialDutyStatus,
            $latitude,
            $longitude,
            $accuracyMetres,
            $locationObservedAt,
            $locationSource,
            $locationName,
            $remarks,
            $occurredAt,
        ): OperatorShift {
            $now = Carbon::now();
            $eventAt = $occurredAt !== null ? Carbon::instance($occurredAt) : $now;

            if ($eventAt->gt($now)) {
                throw ValidationException::withMessages([
                    'occurred_at' => 'The duty event cannot occur in the future.',
                ]);
            }

            $location = $this->locationSnapshotService->resolve(
                latitude: $latitude,
                longitude: $longitude,
                accuracyMetres: $accuracyMetres,
                observedAt: $locationObservedAt,
                source: $locationSource,
                occurredAt: $eventAt,
                acceptedAt: $now,
            );

            // Pessimistic lock on user record to serialize concurrent shift operations per operator
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            // End any existing active shift for this user to avoid dangling open shifts
            $existingShift = OperatorShift::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
                ->latest('started_at')
                ->lockForUpdate()
                ->first();

            if ($existingShift !== null) {
                // If it already has an active duty log, return existing shift
                if ($existingShift->activeDutyLog !== null) {
                    if ($eventAt->lt($existingShift->activeDutyLog->started_at)) {
                        throw ValidationException::withMessages([
                            'occurred_at' => 'This duty event is older than the current accepted duty record.',
                        ]);
                    }

                    return $existingShift->load(['dutyLogs', 'activeDutyLog']);
                }

                if ($eventAt->lt($existingShift->started_at)) {
                    throw ValidationException::withMessages([
                        'occurred_at' => 'This duty event is older than the current shift.',
                    ]);
                }

                // If existing shift has no active log, set to completed
                $existingShift->update([
                    'status' => ShiftStatus::COMPLETED,
                    'ended_at' => $eventAt,
                ]);
            }

            /** @var OperatorShift|null $lastCompletedShift */
            $lastCompletedShift = OperatorShift::query()
                ->where('user_id', $user->id)
                ->whereNotIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
                ->latest('started_at')
                ->lockForUpdate()
                ->first();

            if ($lastCompletedShift?->ended_at !== null && $eventAt->lessThanOrEqualTo($lastCompletedShift->ended_at)) {
                throw ValidationException::withMessages([
                    'occurred_at' => 'This duty event is older than the completed shift.',
                ]);
            }

            /** @var OperatorShift $shift */
            $shift = OperatorShift::create([
                'user_id' => $user->id,
                'operational_asset_id' => $operationalAssetId,
                'dispatch_job_id' => $dispatchJobId,
                'status' => ShiftStatus::ACTIVE,
                'started_at' => $eventAt,
                'remarks' => $remarks,
            ]);

            $dutyLog = OperatorDutyLog::create([
                'operator_shift_id' => $shift->id,
                'user_id' => $user->id,
                'operational_asset_id' => $operationalAssetId,
                'dispatch_job_id' => $dispatchJobId,
                'duty_status' => $initialDutyStatus,
                'is_demurrage_billable' => false,
                'started_at' => $eventAt,
                'occurred_at' => $eventAt,
                'accepted_at' => $now,
                ...$location,
                'location_name' => $locationName,
                'remarks' => $remarks,
            ]);

            if ($initialDutyStatus === DutyStatus::OFF_DUTY) {
                $dutyLog->update([
                    'ended_at' => $eventAt,
                    'duration_minutes' => 0,
                ]);
                $shift->update([
                    'status' => ShiftStatus::COMPLETED,
                    'ended_at' => $eventAt,
                ]);
            }

            return $shift->load(['dutyLogs', 'activeDutyLog']);
        });
    }
}
