<?php

namespace App\Modules\HoursOfService\Actions;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Modules\HoursOfService\Services\DutyLocationSnapshotService;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecordDutyStatusTransitionAction
{
    public function __construct(
        private readonly StartOperatorShiftAction $startShiftAction,
        private readonly DutyLocationSnapshotService $locationSnapshotService,
    ) {}

    public function execute(
        User $user,
        DutyStatus $nextStatus,
        ?StandbyReason $standbyReason = null,
        ?float $latitude = null,
        ?float $longitude = null,
        ?float $accuracyMetres = null,
        ?CarbonInterface $locationObservedAt = null,
        ?string $locationSource = null,
        ?string $locationName = null,
        ?string $remarks = null,
        ?int $operationalAssetId = null,
        ?int $dispatchJobId = null,
        ?CarbonInterface $occurredAt = null,
    ): OperatorShift {
        return DB::transaction(function () use (
            $user,
            $nextStatus,
            $standbyReason,
            $latitude,
            $longitude,
            $accuracyMetres,
            $locationObservedAt,
            $locationSource,
            $locationName,
            $remarks,
            $operationalAssetId,
            $dispatchJobId,
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

            /** @var OperatorShift|null $shift */
            $shift = OperatorShift::query()
                ->where('user_id', $user->id)
                ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
                ->latest('started_at')
                ->lockForUpdate()
                ->first();

            // If no active shift exists and nextStatus is not off_duty, start a shift
            if ($shift === null) {
                if ($nextStatus === DutyStatus::OFF_DUTY) {
                    // Return latest completed shift or create completed snapshot
                    /** @var OperatorShift $lastShift */
                    $lastShift = OperatorShift::query()
                        ->where('user_id', $user->id)
                        ->latest('started_at')
                        ->lockForUpdate()
                        ->firstOr(function () use ($user, $eventAt): OperatorShift {
                            return OperatorShift::create([
                                'user_id' => $user->id,
                                'status' => ShiftStatus::COMPLETED,
                                'started_at' => $eventAt,
                                'ended_at' => $eventAt,
                            ]);
                        });

                    if ($lastShift->ended_at !== null && $eventAt->lt($lastShift->ended_at)) {
                        throw ValidationException::withMessages([
                            'occurred_at' => 'This duty event is older than the completed shift.',
                        ]);
                    }

                    return $lastShift->load(['dutyLogs', 'activeDutyLog']);
                }

                return $this->startShiftAction->execute(
                    user: $user,
                    operationalAssetId: $operationalAssetId,
                    dispatchJobId: $dispatchJobId,
                    initialDutyStatus: $nextStatus,
                    latitude: $latitude,
                    longitude: $longitude,
                    accuracyMetres: $accuracyMetres,
                    locationObservedAt: $locationObservedAt,
                    locationSource: $locationSource,
                    locationName: $locationName,
                    remarks: $remarks,
                    occurredAt: $eventAt,
                );
            }

            // Close the currently active duty log
            /** @var OperatorDutyLog|null $activeLog */
            $activeLog = OperatorDutyLog::query()
                ->where('operator_shift_id', $shift->id)
                ->whereNull('ended_at')
                ->latest('started_at')
                ->lockForUpdate()
                ->first();

            if ($activeLog !== null) {
                if ($eventAt->lt($activeLog->started_at)) {
                    throw ValidationException::withMessages([
                        'occurred_at' => 'This duty event is older than the current accepted duty record.',
                    ]);
                }

                // Selecting the already active state is not a transition. It
                // must not create a zero-length interval or duplicate time.
                if ($activeLog->duty_status === $nextStatus) {
                    return $shift->load(['dutyLogs', 'activeDutyLog']);
                }

                $duration = (int) max(0, $activeLog->started_at->diffInMinutes($eventAt));
                $activeLog->update([
                    'ended_at' => $eventAt,
                    'duration_minutes' => $duration,
                ]);

                // Update cumulative bucket on shift
                $this->accumulateShiftMinutes($shift, $activeLog->duty_status, $duration);
            }

            if ($eventAt->lt($shift->started_at)) {
                throw ValidationException::withMessages([
                    'occurred_at' => 'This duty event is older than the current shift.',
                ]);
            }

            $previousStatus = $activeLog?->duty_status;
            $linkedAssetId = $operationalAssetId ?? $shift->operational_asset_id;
            $linkedJobId = $dispatchJobId ?? $shift->dispatch_job_id;

            // If transitioning to off_duty, record the terminal event before
            // completing the shift. The zero-duration terminal log is an
            // event record, not another hour bucket.
            if ($nextStatus === DutyStatus::OFF_DUTY) {
                OperatorDutyLog::create([
                    'operator_shift_id' => $shift->id,
                    'user_id' => $user->id,
                    'operational_asset_id' => $linkedAssetId,
                    'dispatch_job_id' => $linkedJobId,
                    'previous_duty_status' => $previousStatus,
                    'duty_status' => DutyStatus::OFF_DUTY,
                    'is_demurrage_billable' => false,
                    'started_at' => $eventAt,
                    'ended_at' => $eventAt,
                    'duration_minutes' => 0,
                    'occurred_at' => $eventAt,
                    'accepted_at' => $now,
                    ...$location,
                    'location_name' => $locationName,
                    'remarks' => $remarks,
                ]);

                $shift->update([
                    'status' => ShiftStatus::COMPLETED,
                    'ended_at' => $eventAt,
                ]);
            } else {
                // Update shift status (e.g. on_break vs active)
                $shiftStatus = $nextStatus === DutyStatus::ON_BREAK
                    ? ShiftStatus::ON_BREAK
                    : ShiftStatus::ACTIVE;

                $shift->update([
                    'status' => $shiftStatus,
                ]);

                // Create new duty log
                $isBillable = $nextStatus === DutyStatus::STANDBY && $standbyReason !== null
                    ? $standbyReason->isDemurrageBillable()
                    : false;

                OperatorDutyLog::create([
                    'operator_shift_id' => $shift->id,
                    'user_id' => $user->id,
                    'operational_asset_id' => $linkedAssetId,
                    'dispatch_job_id' => $linkedJobId,
                    'previous_duty_status' => $previousStatus,
                    'duty_status' => $nextStatus,
                    'standby_reason' => $standbyReason,
                    'is_demurrage_billable' => $isBillable,
                    'started_at' => $eventAt,
                    'occurred_at' => $eventAt,
                    'accepted_at' => $now,
                    ...$location,
                    'location_name' => $locationName,
                    'remarks' => $remarks,
                ]);
            }

            return $shift->fresh(['dutyLogs', 'activeDutyLog']);
        });
    }

    private function accumulateShiftMinutes(OperatorShift $shift, DutyStatus $dutyStatus, int $minutes): void
    {
        match ($dutyStatus) {
            DutyStatus::OPERATING => $shift->increment('operating_minutes', $minutes),
            DutyStatus::DRIVING => $shift->increment('driving_minutes', $minutes),
            DutyStatus::STANDBY => $shift->increment('standby_minutes', $minutes),
            DutyStatus::ON_BREAK => $shift->increment('break_minutes', $minutes),
            DutyStatus::OFF_DUTY => null,
        };
    }
}
