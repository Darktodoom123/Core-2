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

class CertifyAndCompleteShiftAction
{
    public function __construct(
        private readonly DutyLocationSnapshotService $locationSnapshotService,
    ) {}

    public function execute(
        User $user,
        string $certificationStatement,
        ?string $remarks = null,
        ?int $operationalAssetId = null,
        ?int $dispatchJobId = null,
        ?float $latitude = null,
        ?float $longitude = null,
        ?float $accuracyMetres = null,
        ?CarbonInterface $locationObservedAt = null,
        ?string $locationSource = null,
        ?string $locationName = null,
        ?CarbonInterface $occurredAt = null,
    ): OperatorShift {
        return DB::transaction(function () use (
            $user,
            $certificationStatement,
            $remarks,
            $operationalAssetId,
            $dispatchJobId,
            $latitude,
            $longitude,
            $accuracyMetres,
            $locationObservedAt,
            $locationSource,
            $locationName,
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

            if ($shift === null) {
                /** @var OperatorShift $lastShift */
                $lastShift = OperatorShift::query()
                    ->where('user_id', $user->id)
                    ->latest('started_at')
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($lastShift->ended_at !== null && $eventAt->lt($lastShift->ended_at)) {
                    throw ValidationException::withMessages([
                        'occurred_at' => 'This certification is older than the completed shift.',
                    ]);
                }

                $lastShift->update([
                    'is_certified' => true,
                    'certified_at' => $now,
                    'certification_statement' => $certificationStatement,
                    'remarks' => $remarks ?? $lastShift->remarks,
                ]);

                return $lastShift->load(['dutyLogs', 'activeDutyLog']);
            }

            // Close active duty log
            /** @var OperatorDutyLog|null $activeLog */
            $activeLog = OperatorDutyLog::query()
                ->where('operator_shift_id', $shift->id)
                ->whereNull('ended_at')
                ->latest('started_at')
                ->lockForUpdate()
                ->first();

            if ($eventAt->lt($shift->started_at)) {
                throw ValidationException::withMessages([
                    'occurred_at' => 'This certification is older than the current shift.',
                ]);
            }

            if ($activeLog !== null) {
                if ($eventAt->lt($activeLog->started_at)) {
                    throw ValidationException::withMessages([
                        'occurred_at' => 'This certification is older than the current duty record.',
                    ]);
                }

                $duration = (int) max(0, $activeLog->started_at->diffInMinutes($eventAt));
                $activeLog->update([
                    'ended_at' => $eventAt,
                    'duration_minutes' => $duration,
                ]);

                $this->accumulateShiftMinutes($shift, $activeLog->duty_status, $duration);
            }

            $linkedAssetId = $operationalAssetId ?? $shift->operational_asset_id;
            $linkedJobId = $dispatchJobId ?? $shift->dispatch_job_id;

            OperatorDutyLog::create([
                'operator_shift_id' => $shift->id,
                'user_id' => $user->id,
                'operational_asset_id' => $linkedAssetId,
                'dispatch_job_id' => $linkedJobId,
                'previous_duty_status' => $activeLog?->duty_status,
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
                'is_certified' => true,
                'certified_at' => $now,
                'certification_statement' => $certificationStatement,
                'remarks' => $remarks ?? $shift->remarks,
            ]);

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
