<?php

namespace App\Modules\Dispatch\Planning\Services;

use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use Illuminate\Validation\ValidationException;

final class ProjectShiftReadiness
{
    public function assertAttemptReady(DispatchExecutionAttempt $attempt): void
    {
        $jobId = $this->projectJobId($attempt);
        if ($jobId === null) {
            return;
        }
        $this->lockPlan($jobId);
        $job = DispatchJob::query()->withTrashed()->lockForUpdate()->findOrFail($jobId);
        $this->assertReady($job);
        $executionPlan = $attempt->planVersions()->latest('version')->latest('id')->lockForUpdate()->first();
        if ($executionPlan === null || $attempt->scheduled_start?->equalTo($job->scheduled_start) !== true
            || $attempt->scheduled_end?->equalTo($job->scheduled_end) !== true
            || $executionPlan->scheduled_start?->equalTo($job->scheduled_start) !== true
            || $executionPlan->scheduled_end?->equalTo($job->scheduled_end) !== true) {
            throw ValidationException::withMessages(['project_plan' => 'The execution schedule differs from the confirmed project shift.']);
        }

        // Approval of a different execution plan must not imply confirmation of its resources.
        $confirmedCrew = $job->personnelAssignments()->whereNull('active_until')->get()
            ->map(fn ($assignment) => $assignment->user_id.':'.$assignment->assignment_type)->sort()->values()->all();
        $executionCrew = $attempt->offers()->where('plan_version_id', $executionPlan->id)
            ->where('status', 'accepted')->whereNull('ended_at')->get()
            ->map(fn ($offer) => $offer->user_id.':'.$offer->assignment_type)->sort()->values()->all();
        $confirmedAssets = $job->assetAssignments()->whereNull('active_until')->pluck('operational_asset_id')
            ->map(fn ($id) => (int) $id)->sort()->values()->all();
        $executionAssets = $executionPlan->requirementSlots()->where('kind', 'asset')->pluck('operational_asset_id')
            ->map(fn ($id) => (int) $id)->sort()->values()->all();
        if ($confirmedCrew !== $executionCrew || $confirmedAssets !== $executionAssets) {
            throw ValidationException::withMessages(['project_plan' => 'The execution crew and assets must match the confirmed project shift.']);
        }
    }

    public function projectJobId(DispatchExecutionAttempt $attempt): ?int
    {
        // Replacement attempts retain their project identity through the source handoff.
        $jobId = $attempt->legacy_dispatch_job_id ?? $attempt->handoff->legacy_dispatch_job_id;

        return ProjectShift::query()->where('dispatch_job_id', $jobId)->exists() ? $jobId : null;
    }

    public function lockPlan(int $jobId): void
    {
        $shift = ProjectShift::query()->with('phase')->where('dispatch_job_id', $jobId)->first();
        if ($shift !== null) {
            ProjectPlan::query()->whereKey($shift->phase->project_plan_id)->lockForUpdate()->firstOrFail();
        }
    }

    /** @return list<string> */
    public function blockers(DispatchJob $job): array
    {
        $shift = ProjectShift::query()->with('phase.plan', 'phase.allocations')->where('dispatch_job_id', $job->id)->first();
        if ($shift === null) {
            return [];
        }
        $phase = $shift->phase;
        $plan = $phase->plan;
        $blockers = [];
        if ($job->trashed()) {
            $blockers[] = 'Restore the archived project shift before dispatch.';
        }
        if ($plan->status !== 'approved' || $plan->approved_version === null) {
            $blockers[] = 'The project baseline needs independent approval.';
        }
        if ($shift->pending_roster !== null) {
            $blockers[] = 'A locked-shift crew change is awaiting independent approval.';
        }
        if ($shift->confirmed_plan_version === null || $shift->confirmed_plan_version !== $plan->approved_version) {
            $blockers[] = 'Confirm crew coverage against the current approved baseline.';
        }
        $crew = $job->personnelAssignments()->whereNull('active_until')->where('response_status', '<>', 'rejected')->get();
        foreach ($phase->coverage as $role => $required) {
            $assigned = $crew->where('assignment_type', $role)->count();
            if ($assigned < $required) {
                $blockers[] = str_replace('_', ' ', ucfirst($role))." coverage {$assigned}/{$required}. Fill the remaining slots.";
            }
        }
        if ($job->scheduled_start === null || $job->scheduled_end === null || $job->scheduled_start->lt($phase->starts_at) || $job->scheduled_end->gt($phase->ends_at)) {
            $blockers[] = 'The shift must remain inside its project phase.';
        }
        $reservations = $phase->allocations->where('kind', 'reservation')->filter(fn ($a) => $a->starts_at->lte($job->scheduled_start) && $a->ends_at->gte($job->scheduled_end));
        if ($reservations->isEmpty()) {
            $blockers[] = 'Reserve an asset for the complete shift window.';
        }
        foreach ($phase->allocations->where('kind', 'maintenance') as $maintenance) {
            if ($maintenance->starts_at->lt($job->scheduled_end) && $maintenance->ends_at->gt($job->scheduled_start)
                && $reservations->contains('operational_asset_id', $maintenance->operational_asset_id)) {
                $blockers[] = 'Planned maintenance interrupts this shift. Adjust the reservation or shift window.';
            }
        }
        $assignedAssets = $job->assetAssignments()->whereNull('active_until')->pluck('operational_asset_id');
        if ($reservations->pluck('operational_asset_id')->diff($assignedAssets)->isNotEmpty()) {
            $blockers[] = 'Reconfirm coverage to apply the current asset reservations.';
        }

        return array_values(array_unique($blockers));
    }

    public function assertReady(DispatchJob $job): void
    {
        $blockers = $this->blockers($job);
        if ($blockers !== []) {
            throw ValidationException::withMessages(['project_plan' => $blockers]);
        }
    }
}
