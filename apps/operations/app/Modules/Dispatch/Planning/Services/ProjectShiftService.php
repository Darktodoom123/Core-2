<?php

namespace App\Modules\Dispatch\Planning\Services;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Actions\CreateManualDispatchHandoff;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ProjectShiftService
{
    public function __construct(
        private readonly ProjectPlanService $plans,
        private readonly CreateManualDispatchHandoff $createDispatch,
        private readonly DispatchResourceEligibility $eligibility,
        private readonly OperationalAssetAvailability $availability,
        private readonly RecordAuditEvent $audit,
    ) {}

    /** @param array<string, mixed> $data */
    public function generate(User $actor, ProjectPlan $plan, int $phaseId, array $data): void
    {
        $this->plans->change($actor, $plan, (int) $data['version'], 'project_plan.shifts_generated', function (ProjectPlan $locked) use ($actor, $phaseId, $data) {
            $shiftCount = ProjectShift::query()->whereHas('phase', fn ($query) => $query->where('project_plan_id', $locked->id))->count();
            if ($shiftCount + (int) $data['days'] > 1000) {
                throw ValidationException::withMessages(['days' => 'A project plan may contain at most 1,000 shifts.']);
            }
            $phase = $this->plans->phase($locked, $phaseId);
            $start = CarbonImmutable::parse($data['starts_at']);
            $end = CarbonImmutable::parse($data['ends_at']);
            if ($start->diffInHours($end) > 24) {
                throw ValidationException::withMessages(['ends_at' => 'A shift may span at most 24 hours.']);
            }
            for ($day = 0; $day < (int) $data['days']; $day++) {
                $from = $start->addDays($day);
                $to = $end->addDays($day);
                if ($from->lt($phase->starts_at) || $to->gt($phase->ends_at)) {
                    throw ValidationException::withMessages(['starts_at' => 'Every generated shift must fit inside the phase.']);
                }
                if ($phase->shifts()->whereHas('job', fn ($q) => $q->where('scheduled_start', $from)->where('scheduled_end', $to))->exists()) {
                    throw ValidationException::withMessages(['starts_at' => 'A shift already exists for this time window.']);
                }
                $job = $this->createDispatch->handle($actor, [
                    'client' => $locked->client, 'title' => $locked->name.' · '.$phase->name,
                    'site' => $locked->site, 'scheduled_start' => $from, 'scheduled_end' => $to,
                    'priority' => 'routine', 'requirements' => ['Project reference: '.$locked->source_reference],
                ]);
                $phase->shifts()->create(['dispatch_job_id' => $job->id]);
            }
        }, false);
    }

    /** @param list<array{user_id:int,assignment_type:string}> $roster */
    public function validateRoster(ProjectShift $shift, array $roster): void
    {
        $job = $shift->job;
        $users = User::query()->whereIn('id', array_column($roster, 'user_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        $counts = [];
        foreach ($roster as $entry) {
            $user = $users->get($entry['user_id']);
            if ($user === null) {
                throw ValidationException::withMessages(['personnel' => 'A selected worker no longer exists.']);
            }
            $assessment = $this->eligibility->personnel($user, $entry['assignment_type'], $job, true);
            if (! $assessment['eligible']) {
                throw ValidationException::withMessages(['personnel' => $user->name.': '.implode(' ', $assessment['reasons'])]);
            }
            $counts[$entry['assignment_type']] = ($counts[$entry['assignment_type']] ?? 0) + 1;
        }
        foreach ($counts as $role => $count) {
            if ($count > ($shift->phase->coverage[$role] ?? 0)) {
                throw ValidationException::withMessages(['personnel' => 'Crew exceeds the approved role coverage. Update the baseline first.']);
            }
        }
        if (! in_array($job->status, [DispatchStatus::Draft, DispatchStatus::PendingApproval, DispatchStatus::Scheduled], true)) {
            foreach ($shift->phase->coverage as $role => $required) {
                if (($counts[$role] ?? 0) < $required) {
                    throw ValidationException::withMessages(['personnel' => 'An active shift must retain its complete approved crew coverage.']);
                }
            }
        }
    }

    /** @param array<string, mixed> $data */
    public function roster(User $actor, ProjectPlan $plan, int $shiftId, array $data): void
    {
        $this->plans->change($actor, $plan, (int) $data['version'], 'project_plan.coverage_changed', function (ProjectPlan $locked) use ($actor, $shiftId, $data) {
            $shift = $this->lockedShift($locked, $shiftId, (int) $data['shift_version']);
            if ($locked->status !== 'approved') {
                throw ValidationException::withMessages(['plan' => 'Approve the baseline before confirming named crews.']);
            }
            $roster = $this->rosterData($data);
            $this->validateRoster($shift, $roster);
            if ($shift->job->scheduled_start->lte(now()->addDay())
                || ! in_array($shift->job->status, [DispatchStatus::Draft, DispatchStatus::PendingApproval, DispatchStatus::Scheduled], true)) {
                $shift->update(['pending_roster' => $roster, 'requested_by' => $actor->id, 'reason' => $data['reason'], 'version' => $shift->version + 1]);
                $this->audit->handle($actor, $shift, 'project_shift.exception_requested', null, ['personnel' => $roster], $data['reason']);
            } else {
                $this->applyRoster($actor, $shift, $roster, (int) $locked->approved_by);
            }
        }, false);
    }

    /** @param array<string, mixed> $data */
    public function decide(User $actor, ProjectPlan $plan, int $shiftId, array $data): void
    {
        abort_unless(PlanningAccess::approve($actor), 403);
        DB::transaction(function () use ($actor, $plan, $shiftId, $data) {
            $locked = ProjectPlan::query()->lockForUpdate()->findOrFail($plan->id);
            $this->plans->assertVersion($locked, (int) $data['version']);
            $shift = $this->lockedShift($locked, $shiftId, (int) $data['shift_version']);
            abort_if($shift->requested_by === $actor->id, 403);
            if ($shift->pending_roster === null || $locked->status !== 'approved') {
                throw ValidationException::withMessages(['shift' => 'A pending crew change and an approved baseline are required.']);
            }
            if ($data['decision'] === 'approved') {
                $this->validateRoster($shift, $shift->pending_roster);
                $this->applyRoster($actor, $shift, $shift->pending_roster, $actor->id);
            } else {
                $shift->update(['pending_roster' => null, 'requested_by' => null, 'version' => $shift->version + 1]);
            }
            $locked->increment('version');
            $this->audit->handle($actor, $shift, 'project_shift.exception_'.$data['decision'], null, null, $data['reason']);
        });
    }

    private function lockedShift(ProjectPlan $plan, int $id, int $version): ProjectShift
    {
        $shift = ProjectShift::query()->whereHas('phase', fn ($q) => $q->where('project_plan_id', $plan->id))->with('phase.plan')->lockForUpdate()->findOrFail($id);
        $job = DispatchJob::query()->withTrashed()->lockForUpdate()->findOrFail($shift->dispatch_job_id);
        $shift->setRelation('job', $job);
        if ($job->trashed()) {
            throw ValidationException::withMessages(['shift' => 'Restore the archived shift before changing its crew.']);
        }
        if ($shift->version !== $version) {
            throw ValidationException::withMessages(['version' => 'This shift changed. Refresh before editing its crew.']);
        }
        if (in_array($job->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true)) {
            throw ValidationException::withMessages(['shift' => 'Completed or cancelled shifts cannot be changed.']);
        }

        return $shift;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array{user_id:int, assignment_type:string}>
     */
    private function rosterData(array $data): array
    {
        $value = $data['personnel'] ?? null;
        if (! is_array($value)) {
            throw ValidationException::withMessages(['personnel' => 'Choose a valid crew roster.']);
        }

        $roster = [];
        foreach ($value as $entry) {
            if (! is_array($entry) || ! isset($entry['user_id'], $entry['assignment_type']) || ! is_numeric($entry['user_id']) || ! is_string($entry['assignment_type'])) {
                throw ValidationException::withMessages(['personnel' => 'Choose a valid crew roster.']);
            }
            $roster[] = ['user_id' => (int) $entry['user_id'], 'assignment_type' => $entry['assignment_type']];
        }

        return $roster;
    }

    /** @param list<array{user_id:int,assignment_type:string}> $roster */
    private function applyRoster(User $actor, ProjectShift $shift, array $roster, int $approverId): void
    {
        $job = $shift->job;
        $phase = $shift->phase;
        $plan = $phase->plan;
        $reservations = $phase->allocations()->where('kind', 'reservation')->where('starts_at', '<=', $job->scheduled_start)->where('ends_at', '>=', $job->scheduled_end)->get();
        $assets = $this->availability->lockAssetsForUpdate($reservations->pluck('operational_asset_id')->all());
        foreach ($assets as $asset) {
            $this->availability->assertNoConflict(new AssetUsageRequest(
                $asset->id, AssetUsageType::DispatchActivate, $job->scheduled_start->toImmutable(), $job->scheduled_end->toImmutable(),
                source: new AssetUsageSource('dispatch_job', $job->id),
            ), 'assets');
        }
        $existing = $job->personnelAssignments()->whereNull('active_until')->get();
        $before = $existing->toArray();
        foreach ($existing as $assignment) {
            $retained = collect($roster)->contains(fn ($r) => (int) $r['user_id'] === $assignment->user_id && $r['assignment_type'] === $assignment->assignment_type);
            if (! $retained) {
                $assignment->update(['active_until' => now()]);
            }
        }
        foreach ($roster as $entry) {
            if (! $existing->contains(fn ($a) => $a->user_id === (int) $entry['user_id'] && $a->assignment_type === $entry['assignment_type'])) {
                $job->personnelAssignments()->create([...$entry, 'assigned_by' => $actor->id, 'approved_by' => $approverId, 'active_from' => $job->scheduled_start]);
            }
        }
        $job->assetAssignments()->whereNull('active_until')->whereNotIn('operational_asset_id', $assets->keys())->update(['active_until' => now()]);
        foreach ($assets as $asset) {
            $job->assetAssignments()->firstOrCreate(['operational_asset_id' => $asset->id, 'active_until' => null], ['assignment_type' => $asset->kind, 'assigned_by' => $actor->id, 'approved_by' => $approverId, 'active_from' => $job->scheduled_start]);
        }
        ApprovalRequest::query()->create([
            'subject_type' => $job->getMorphClass(), 'subject_id' => $job->id, 'kind' => 'assignment_override',
            'requested_changes' => ['project_plan_id' => $plan->id, 'baseline_version' => $plan->approved_version, 'personnel' => $roster],
            'status' => ApprovalStatus::Approved, 'requested_by' => $shift->requested_by ?? $plan->submitted_by,
            'decided_by' => $approverId, 'decided_at' => now(), 'reason' => 'Covered by approved project baseline or independent shift exception.',
        ]);
        $shift->update(['pending_roster' => null, 'requested_by' => null, 'confirmed_plan_version' => $plan->approved_version, 'version' => $shift->version + 1]);
        $job->increment('version');
        $this->audit->handle($actor, $job, 'project_shift.coverage_confirmed', ['personnel' => $before], ['personnel' => $roster, 'project_plan_id' => $plan->id, 'baseline_version' => $plan->approved_version]);
    }
}
