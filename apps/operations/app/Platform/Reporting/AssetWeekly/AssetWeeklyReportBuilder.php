<?php

namespace App\Platform\Reporting\AssetWeekly;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use BackedEnum;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Assembles one asset's activity for one Monday–Sunday week from recorded
 * data only: asset assignments, shifts, fuel logs, job reports, DVIRs and
 * work orders. Missing values stay null — nothing is estimated or filled in.
 */
final class AssetWeeklyReportBuilder
{
    public const TIMEZONE = 'Asia/Manila';

    public static function canView(User $actor): bool
    {
        return $actor->can(PermissionName::ReportsViewAll->value)
            || $actor->can(PermissionName::FleetViewAll->value)
            || $actor->can(PermissionName::EquipmentViewAll->value);
    }

    /** Monday 00:00 (report timezone) of the week containing $date, or of the current week. */
    public static function weekStart(?string $date): CarbonImmutable
    {
        $day = $date !== null && $date !== ''
            ? CarbonImmutable::parse($date, self::TIMEZONE)
            : CarbonImmutable::now(self::TIMEZONE);

        return $day->startOfWeek(CarbonInterface::MONDAY)->startOfDay();
    }

    /** @return array<string, mixed> */
    public function build(User $actor, OperationalAsset $asset, CarbonImmutable $weekStart): array
    {
        $weekEnd = $weekStart->addWeek()->subSecond();
        $fromUtc = $weekStart->utc();
        $toUtc = $weekEnd->utc();

        $shiftsOnAsset = OperatorShift::query()
            ->with(['user', 'dispatchJob'])
            ->where('operational_asset_id', $asset->id)
            ->where('started_at', '<=', $toUtc)
            ->where(fn ($q) => $q->whereNull('ended_at')->orWhere('ended_at', '>=', $fromUtc))
            ->orderBy('started_at')
            ->get();

        $fuelLogs = FuelLog::query()
            ->with(['request.job', 'recorder'])
            ->whereIn('fuel_request_id', FuelRequest::visibleTo($actor)
                ->where('operational_asset_id', $asset->id)
                ->select('id'))
            ->whereBetween('recorded_at', [$fromUtc, $toUtc])
            ->orderBy('recorded_at')
            ->get();

        $assignedJobIds = DispatchAssetAssignment::query()
            ->join('dispatch_jobs', 'dispatch_jobs.id', '=', 'dispatch_asset_assignments.dispatch_job_id')
            ->where('dispatch_asset_assignments.operational_asset_id', $asset->id)
            ->whereRaw('COALESCE(dispatch_asset_assignments.active_from, dispatch_jobs.scheduled_start, dispatch_asset_assignments.created_at) <= ?', [$toUtc])
            ->where(function ($q) use ($fromUtc): void {
                $q->whereRaw('COALESCE(dispatch_asset_assignments.active_until, dispatch_jobs.scheduled_end) >= ?', [$fromUtc])
                    ->orWhere(fn ($open) => $open->whereNull('dispatch_asset_assignments.active_until')->whereNull('dispatch_jobs.scheduled_end'));
            })
            ->pluck('dispatch_asset_assignments.dispatch_job_id');

        $jobIds = $assignedJobIds
            ->merge($shiftsOnAsset->pluck('dispatch_job_id'))
            ->merge($fuelLogs->map(fn (FuelLog $log) => $log->request->dispatch_job_id))
            ->filter()
            ->unique()
            ->values();

        $jobs = DispatchJob::query()
            ->whereIn('id', $jobIds)
            ->orderByRaw('scheduled_start IS NULL, scheduled_start')
            ->get();

        $personnelAssignments = DispatchPersonnelAssignment::query()
            ->with('user')
            ->whereIn('dispatch_job_id', $jobIds)
            ->get();

        $personnelIds = $personnelAssignments->pluck('user_id')
            ->merge($shiftsOnAsset->pluck('user_id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        // Full-week shifts for everyone on this asset, on any asset.
        $weekShifts = OperatorShift::query()
            ->whereIn('user_id', $personnelIds)
            ->where('started_at', '<=', $toUtc)
            ->where(fn ($q) => $q->whereNull('ended_at')->orWhere('ended_at', '>=', $fromUtc))
            ->get();

        $jobReports = JobReport::visibleTo($actor)
            ->with(['job', 'author'])
            ->whereIn('dispatch_job_id', $jobIds)
            ->where(function ($q) use ($fromUtc, $toUtc): void {
                $q->whereBetween('started_at', [$fromUtc, $toUtc])
                    ->orWhereBetween('submitted_at', [$fromUtc, $toUtc])
                    ->orWhere(fn ($draft) => $draft->whereNull('started_at')->whereNull('submitted_at')->whereBetween('created_at', [$fromUtc, $toUtc]));
            })
            ->orderBy('id')
            ->get();

        $inspections = DvirInspection::query()
            ->with('user')
            ->where('operational_asset_id', $asset->id)
            ->whereBetween('completed_at', [$fromUtc, $toUtc])
            ->orderBy('completed_at')
            ->get();

        $workOrders = MaintenanceWorkOrder::query()
            ->where('operational_asset_id', $asset->id)
            ->where(function ($q) use ($fromUtc, $toUtc): void {
                $q->whereBetween('created_at', [$fromUtc, $toUtc])
                    ->orWhereBetween('scheduled_at', [$fromUtc, $toUtc])
                    ->orWhereBetween('completed_at', [$fromUtc, $toUtc]);
            })
            ->orderBy('id')
            ->get();

        $fuelRows = $fuelLogs->map(fn (FuelLog $log): array => [
            'id' => $log->id,
            'recorded_at' => $this->iso($log->recorded_at),
            'job_reference' => $log->request->job?->reference,
            'fuel_type' => $log->request->fuel_type,
            'requested_litres' => $this->num($log->request->quantity_litres),
            'actual_litres' => $this->num($log->quantity_litres),
            'variance_litres' => $this->num($log->variance_litres),
            'price_per_litre' => $this->num($log->price_per_litre),
            'total_cost' => $this->num($log->total_cost),
            'burn_rate' => $this->num($log->effective_burn_rate),
            'burn_rate_unit' => $this->unitLabel($log->burn_rate_unit),
            'is_anomaly' => (bool) $log->is_anomaly,
            'anomaly_reason' => $log->anomaly_reason,
            'station' => $log->fuel_station,
            'recorded_by' => $log->recorder->name,
        ])->values();

        $shiftRows = $shiftsOnAsset->map(fn (OperatorShift $shift): array => [
            'id' => $shift->id,
            'operator' => $shift->user->name,
            'job_reference' => $shift->dispatchJob?->reference,
            'status' => $this->enumLabel($shift->status),
            'started_at' => $this->iso($shift->started_at),
            'ended_at' => $this->iso($shift->ended_at),
            'on_duty_minutes' => $this->minutesWithin($shift->started_at, $shift->ended_at, $fromUtc, $toUtc),
            'operating_minutes' => (int) $shift->operating_minutes,
            'driving_minutes' => (int) $shift->driving_minutes,
            'standby_minutes' => (int) $shift->standby_minutes,
            'break_minutes' => (int) $shift->break_minutes,
            'is_certified' => (bool) $shift->is_certified,
        ])->values();

        $reportRows = $jobReports->map(function (JobReport $report): array {
            $duration = $report->started_at !== null && $report->ended_at !== null && $report->ended_at->gte($report->started_at)
                ? (int) round($report->started_at->diffInMinutes($report->ended_at))
                : null;

            return [
                'id' => $report->id,
                'job_reference' => $report->job->reference,
                'author' => $report->author?->name,
                'status' => $report->status->label(),
                'started_at' => $this->iso($report->started_at),
                'ended_at' => $this->iso($report->ended_at),
                'duration_minutes' => $duration,
                'ending_meter_value' => $report->ending_meter_value,
                'meter_unit' => match ($report->meter_type) {
                    'engine_hours' => 'hrs',
                    'odometer_km' => 'km',
                    default => null,
                },
                'signer_name' => $report->signer_name,
                'submitted_at' => $this->iso($report->submitted_at),
                'work_summary' => $report->work_summary,
            ];
        })->values();

        $burnRates = $fuelLogs->pluck('effective_burn_rate')->filter(fn ($v) => $v !== null)->map(fn ($v) => (float) $v);
        $costs = $fuelLogs->pluck('total_cost')->filter(fn ($v) => $v !== null);

        return [
            'asset' => [
                'id' => $asset->id,
                'code' => $asset->code,
                'name' => $asset->name,
                'kind' => $asset->kind,
                'registration_number' => $asset->registration_number,
                'status' => $this->enumLabel($asset->status),
                'baseline_burn_rate' => $this->num($asset->baseline_burn_rate),
                'burn_rate_unit' => $this->unitLabel($asset->burn_rate_unit),
            ],
            'week' => [
                'start' => $weekStart->toDateString(),
                'end' => $weekEnd->toDateString(),
                'previous' => $weekStart->subWeek()->toDateString(),
                'next' => $weekStart->addWeek()->toDateString(),
                'label' => $weekStart->format('M j').' – '.$weekEnd->format('M j, Y'),
                'timezone' => self::TIMEZONE,
            ],
            'generated_at' => CarbonImmutable::now(self::TIMEZONE)->toIso8601String(),
            'currency' => 'PHP',
            'summary' => [
                'jobs' => $jobs->count(),
                'personnel' => $personnelIds->count(),
                'shifts' => $shiftRows->count(),
                'on_duty_minutes' => $shiftRows->sum('on_duty_minutes'),
                'operating_minutes' => $shiftRows->sum('operating_minutes'),
                'job_reports' => $reportRows->count(),
                'reported_work_minutes' => $reportRows->sum(fn ($r) => $r['duration_minutes'] ?? 0),
                'fuel_logs' => $fuelRows->count(),
                'fuel_litres' => round((float) $fuelLogs->sum(fn ($l) => (float) $l->quantity_litres), 2),
                // Null when no log carries a cost, so "no data" never reads as ₱0.
                'fuel_cost' => $costs->isEmpty() ? null : round((float) $costs->sum(fn ($v) => (float) $v), 2),
                'average_burn_rate' => $burnRates->isEmpty() ? null : round($burnRates->avg(), 2),
                'fuel_anomalies' => $fuelLogs->where('is_anomaly', true)->count(),
                'inspections' => $inspections->count(),
                'inspections_with_defects' => $inspections->where('has_defects', true)->count(),
                'work_orders' => $workOrders->count(),
            ],
            'days' => $this->days($weekStart, $jobs, $shiftsOnAsset),
            'personnel' => $this->personnel($personnelIds, $personnelAssignments, $shiftsOnAsset, $weekShifts, $jobs, $fromUtc, $toUtc),
            'jobs' => $jobs->map(fn (DispatchJob $job): array => [
                'id' => $job->id,
                'reference' => $job->reference,
                'title' => $job->title,
                'client' => $job->client,
                'site' => $job->site,
                'status' => $this->enumLabel($job->status),
                'scheduled_start' => $this->iso($job->scheduled_start),
                'scheduled_end' => $this->iso($job->scheduled_end),
            ])->values()->all(),
            'fuel' => $fuelRows->all(),
            'shifts' => $shiftRows->all(),
            'job_reports' => $reportRows->all(),
            'inspections' => $inspections->map(fn (DvirInspection $inspection): array => [
                'id' => $inspection->id,
                'reference' => $inspection->reference,
                'type' => $this->enumLabel($inspection->inspection_type),
                'inspector' => $inspection->user->name,
                'completed_at' => $this->iso($inspection->completed_at),
                'has_defects' => (bool) $inspection->has_defects,
                'critical_defects_count' => (int) $inspection->critical_defects_count,
            ])->values()->all(),
            'work_orders' => $workOrders->map(fn (MaintenanceWorkOrder $order): array => [
                'id' => $order->id,
                'defect' => $order->defect,
                'status' => $this->enumLabel($order->status),
                'dispatch_blocking' => (bool) $order->dispatch_blocking,
                'scheduled_at' => $this->iso($order->scheduled_at),
                'completed_at' => $this->iso($order->completed_at),
            ])->values()->all(),
        ];
    }

    /**
     * @param  Collection<int, DispatchJob>  $jobs
     * @param  Collection<int, OperatorShift>  $shifts
     * @return list<array<string, mixed>>
     */
    private function days(CarbonImmutable $weekStart, Collection $jobs, Collection $shifts): array
    {
        $days = [];

        for ($i = 0; $i < 7; $i++) {
            $dayStart = $weekStart->addDays($i);
            $dayEnd = $dayStart->endOfDay();
            $fromUtc = $dayStart->utc();
            $toUtc = $dayEnd->utc();

            $dayJobs = $jobs->filter(fn (DispatchJob $job) => $job->scheduled_start !== null
                && $job->scheduled_start->lte($toUtc)
                && ($job->scheduled_end ?? $job->scheduled_start)->gte($fromUtc));

            $dayShifts = $shifts->filter(fn (OperatorShift $shift) => $shift->started_at->lte($toUtc)
                && ($shift->ended_at === null || $shift->ended_at->gte($fromUtc)));

            $days[] = [
                'date' => $dayStart->toDateString(),
                'label' => $dayStart->format('D, M j'),
                'jobs' => $dayJobs->pluck('reference')->values()->all(),
                'operators' => $dayShifts->map(fn (OperatorShift $s) => $s->user->name)->filter()->unique()->values()->all(),
                'on_duty_minutes' => $dayShifts->sum(fn (OperatorShift $s) => $this->minutesWithin($s->started_at, $s->ended_at, $fromUtc, $toUtc)),
            ];
        }

        return $days;
    }

    /**
     * @param  Collection<int, int>  $personnelIds
     * @param  Collection<int, DispatchPersonnelAssignment>  $assignments
     * @param  Collection<int, OperatorShift>  $shiftsOnAsset
     * @param  Collection<int, OperatorShift>  $weekShifts
     * @param  Collection<int, DispatchJob>  $jobs
     * @return list<array<string, mixed>>
     */
    private function personnel(
        Collection $personnelIds,
        Collection $assignments,
        Collection $shiftsOnAsset,
        Collection $weekShifts,
        Collection $jobs,
        CarbonInterface $fromUtc,
        CarbonInterface $toUtc,
    ): array {
        $jobRefs = $jobs->pluck('reference', 'id');
        $names = $assignments->mapWithKeys(fn ($a) => [$a->user_id => $a->user?->name])
            ->union($shiftsOnAsset->mapWithKeys(fn ($s) => [$s->user_id => $s->user?->name]));

        return $personnelIds->map(function (int $userId) use ($assignments, $shiftsOnAsset, $weekShifts, $jobRefs, $names, $fromUtc, $toUtc): array {
            $mine = $assignments->where('user_id', $userId);
            $onAsset = $shiftsOnAsset->where('user_id', $userId);
            $allWeek = $weekShifts->where('user_id', $userId);

            return [
                'user_id' => $userId,
                'name' => $names[$userId] ?? 'Unknown',
                'roles' => $mine->pluck('assignment_type')->filter()->unique()->values()->all(),
                'jobs' => $mine->map(fn ($a) => $jobRefs[$a->dispatch_job_id] ?? null)->filter()->unique()->values()->all(),
                'response' => $mine->map(fn ($a) => $this->enumLabel($a->response_status))->filter()->unique()->implode(', ') ?: null,
                'assigned_from' => $this->iso($mine->pluck('active_from')->filter()->min()),
                'assigned_until' => $this->iso($mine->pluck('active_until')->filter()->max()),
                'shifts_on_asset' => $onAsset->count(),
                'minutes_on_asset' => $onAsset->sum(fn ($s) => $this->minutesWithin($s->started_at, $s->ended_at, $fromUtc, $toUtc)),
                'week_shifts' => $allWeek->count(),
                'week_on_duty_minutes' => $allWeek->sum(fn ($s) => $this->minutesWithin($s->started_at, $s->ended_at, $fromUtc, $toUtc)),
                'week_operating_minutes' => (int) $allWeek->sum('operating_minutes'),
                'week_driving_minutes' => (int) $allWeek->sum('driving_minutes'),
                'week_standby_minutes' => (int) $allWeek->sum('standby_minutes'),
                'week_break_minutes' => (int) $allWeek->sum('break_minutes'),
            ];
        })->sortBy('name')->values()->all();
    }

    /** Minutes of [start, end ?? now] that fall inside [from, to]. */
    private function minutesWithin(?CarbonInterface $start, ?CarbonInterface $end, CarbonInterface $from, CarbonInterface $to): int
    {
        if ($start === null) {
            return 0;
        }

        $end ??= CarbonImmutable::now();
        $clippedStart = $start->greaterThan($from) ? $start : $from;
        $clippedEnd = $end->lessThan($to) ? $end : $to;

        return $clippedEnd->greaterThan($clippedStart)
            ? (int) round($clippedStart->diffInMinutes($clippedEnd))
            : 0;
    }

    private function iso(mixed $value): ?string
    {
        return $value instanceof CarbonInterface
            ? $value->copy()->setTimezone(self::TIMEZONE)->toIso8601String()
            : null;
    }

    /** "litres_per_hour" → "litres per hour"; also accepts backed enums. */
    private function unitLabel(mixed $unit): ?string
    {
        $value = $unit instanceof BackedEnum ? (string) $unit->value : $unit;

        return is_string($value) && $value !== '' ? str_replace('_', ' ', $value) : null;
    }

    private function num(mixed $value): ?float
    {
        return $value === null || $value === '' ? null : (float) $value;
    }

    private function enumLabel(mixed $value): ?string
    {
        if ($value instanceof BackedEnum) {
            return method_exists($value, 'label') ? $value->label() : ucwords(str_replace('_', ' ', (string) $value->value));
        }

        return is_string($value) && $value !== '' ? ucwords(str_replace('_', ' ', $value)) : null;
    }
}
