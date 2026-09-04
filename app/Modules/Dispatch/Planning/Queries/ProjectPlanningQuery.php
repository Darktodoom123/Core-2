<?php

namespace App\Modules\Dispatch\Planning\Queries;

use App\Modules\Dispatch\Planning\Models\ProjectAllocation;
use App\Modules\Dispatch\Planning\Models\ProjectPhase;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Modules\Dispatch\Planning\Services\PlanningAccess;
use App\Platform\Identity\Models\User;

final class ProjectPlanningQuery
{
    /** @return array<string, mixed>|null */
    public function make(User $actor): ?array
    {
        if (! PlanningAccess::view($actor)) {
            return null;
        }
        $pageNumber = max(1, (int) request()->query('planning_page', 1));
        $search = substr((string) request()->query('planning_search', ''), 0, 100);
        $page = ProjectPlan::query()->when($search !== '', fn ($q) => $q->where(fn ($q) => $q->where('name', 'like', '%'.$search.'%')->orWhere('source_reference', 'like', '%'.$search.'%')))
            ->with(['phases.allocations.asset', 'phases.shifts.job.personnelAssignments.user', 'phases.shifts.job.assetAssignments.asset'])
            ->latest('id')->paginate(10, ['*'], 'planning_page', $pageNumber);
        $pendingUserIds = $page->getCollection()->flatMap(fn (ProjectPlan $plan) => $plan->phases)
            ->flatMap(fn (ProjectPhase $phase) => $phase->shifts)
            ->flatMap(fn (ProjectShift $shift) => array_column($shift->pending_roster ?? [], 'user_id'))->unique()->all();
        $pendingNames = User::query()->whereIn('id', $pendingUserIds)->pluck('name', 'id')->all();
        $page->through(fn (ProjectPlan $plan) => [
            'id' => $plan->id, 'name' => $plan->name, 'source_reference' => $plan->source_reference,
            'client' => $plan->client, 'site' => $plan->site, 'status' => $plan->status, 'version' => $plan->version,
            'approved_version' => $plan->approved_version, 'decision_reason' => $plan->decision_reason,
            'can_decide' => PlanningAccess::approve($actor) && $plan->status === 'pending' && ! in_array($actor->id, [$plan->created_by, $plan->submitted_by], true),
            'phases' => $plan->phases->map(fn (ProjectPhase $phase) => [
                'id' => $phase->id, 'name' => $phase->name, 'kind' => $phase->kind,
                'starts_at' => $phase->starts_at->toIso8601String(), 'ends_at' => $phase->ends_at->toIso8601String(), 'coverage' => $phase->coverage,
                'allocations' => $phase->allocations->map(fn (ProjectAllocation $a) => ['id' => $a->id, 'operational_asset_id' => $a->operational_asset_id, 'code' => $a->asset->code, 'name' => $a->asset->name, 'status' => $a->asset->status->value, 'kind' => $a->kind, 'starts_at' => $a->starts_at->toIso8601String(), 'ends_at' => $a->ends_at->toIso8601String(), 'notes' => $a->notes])->all(),
                'shifts' => $phase->shifts->map(fn (ProjectShift $s) => $this->shift($s, $actor, $pendingNames))->values()->all(),
            ])->all(),
        ]);

        return ['projects' => $page->items(), 'page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'can_edit' => PlanningAccess::edit($actor), 'as_of' => now()->toIso8601String()];
    }

    /**
     * @param  array<int, string>  $pendingNames
     * @return array<string, mixed>
     */
    private function shift(ProjectShift $shift, User $actor, array $pendingNames): array
    {
        $job = $shift->job;
        $crew = $job->personnelAssignments->whereNull('active_until');

        return [
            'id' => $shift->id, 'job_id' => $job->id, 'reference' => $job->reference, 'status' => $job->status->value,
            'starts_at' => $job->scheduled_start?->toIso8601String(), 'ends_at' => $job->scheduled_end?->toIso8601String(),
            'version' => $shift->version, 'locked' => ($job->scheduled_start?->lte(now()->addDay()) ?? true) || ! in_array($job->status->value, ['draft', 'pending_approval', 'scheduled'], true), 'archived' => $job->trashed(),
            'personnel' => $crew->map(fn ($a) => ['user_id' => $a->user_id, 'name' => $a->user->name, 'assignment_type' => $a->assignment_type, 'response' => $a->response_status->value])->values()->all(),
            'pending_roster' => $shift->pending_roster === null ? null : array_map(fn (array $entry) => [...$entry, 'name' => $pendingNames[$entry['user_id']] ?? 'Unavailable worker'], $shift->pending_roster), 'reason' => $shift->reason,
            'can_decide' => ! $job->trashed() && $shift->pending_roster !== null && $shift->requested_by !== $actor->id && PlanningAccess::approve($actor),
            'confirmed_plan_version' => $shift->confirmed_plan_version,
        ];
    }
}
