<?php

namespace App\Modules\Dispatch\Planning\Services;

use App\Modules\Dispatch\Planning\Models\ProjectAllocation;
use App\Modules\Dispatch\Planning\Models\ProjectPhase;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ProjectPlanService
{
    public function __construct(private readonly RecordAuditEvent $audit, private readonly OperationalAssetAvailability $availability) {}

    /** @param array<string, mixed> $data */
    public function create(User $actor, array $data): ProjectPlan
    {
        abort_unless(PlanningAccess::edit($actor), 403);

        return DB::transaction(function () use ($actor, $data) {
            $plan = ProjectPlan::query()->create([
                'name' => $data['name'], 'source_reference' => $data['source_reference'],
                'client' => $data['client'], 'site' => $data['site'], 'created_by' => $actor->id,
            ]);
            $this->audit->handle($actor, $plan, 'project_plan.created', null, $plan->toArray());

            return $plan;
        });
    }

    /** @param Closure(ProjectPlan):void $operation */
    public function change(User $actor, ProjectPlan $plan, int $version, string $action, Closure $operation, bool $baseline = true): void
    {
        abort_unless(PlanningAccess::edit($actor), 403);
        DB::transaction(function () use ($actor, $plan, $version, $action, $operation, $baseline) {
            $locked = ProjectPlan::query()->lockForUpdate()->findOrFail($plan->id);
            $this->assertVersion($locked, $version);
            $before = $locked->toArray();
            $operation($locked);
            $locked->version++;
            if ($baseline) {
                $locked->status = 'draft';
                $locked->approved_version = null;
                $locked->approved_by = null;
                $locked->approved_at = null;
                $locked->submitted_by = null;
            }
            $locked->save();
            $this->audit->handle($actor, $locked, $action, $before, $locked->toArray());
        });
    }

    public function assertVersion(ProjectPlan $plan, int $version): void
    {
        if ($plan->version !== $version) {
            throw ValidationException::withMessages(['version' => 'This project plan changed. Refresh and review the latest version.']);
        }
    }

    public function phase(ProjectPlan $plan, int $id): ProjectPhase
    {
        return $plan->phases()->whereKey($id)->firstOrFail();
    }

    /** @param array<string, mixed> $data */
    public function savePhase(User $actor, ProjectPlan $plan, array $data, ?int $id = null): void
    {
        $this->change($actor, $plan, (int) $data['version'], 'project_plan.phase_changed', function (ProjectPlan $locked) use ($data, $id, $actor) {
            if ($id === null && $locked->phases()->count() >= 32) {
                throw ValidationException::withMessages(['phase' => 'A project plan may contain at most 32 phases.']);
            }
            $phase = $id === null ? new ProjectPhase(['project_plan_id' => $locked->id]) : $this->phase($locked, $id);
            if ($phase->exists && $phase->shifts()->whereHas('job', fn ($query) => $query->whereNull('deleted_at')
                ->whereNotIn('status', ['draft', 'pending_approval', 'scheduled', 'completed', 'cancelled']))->exists()) {
                throw ValidationException::withMessages(['phase' => 'An active shift uses this phase. Finish or cancel it before changing the phase.']);
            }
            $start = CarbonImmutable::parse($data['starts_at']);
            $end = CarbonImmutable::parse($data['ends_at']);
            if ($phase->exists && ($phase->allocations()->where(fn ($q) => $q->where('starts_at', '<', $start)->orWhere('ends_at', '>', $end))->exists()
                || $phase->shifts()->whereHas('job', fn ($q) => $q->where('scheduled_start', '<', $start)->orWhere('scheduled_end', '>', $end))->exists())) {
                throw ValidationException::withMessages(['starts_at' => 'The phase must contain all existing allocations and shifts.']);
            }
            $before = $phase->exists ? $phase->toArray() : null;
            $phase->fill(['name' => $data['name'], 'kind' => $data['kind'], 'starts_at' => $start, 'ends_at' => $end, 'coverage' => $data['coverage']])->save();
            $this->audit->handle($actor, $phase, 'project_phase.saved', $before, $phase->toArray());
        });
    }

    /** @param array<string, mixed> $data
     * @return array{conflicts:list<string>,affected_shifts:list<array{id:int,reference:string}>,approval:string}
     */
    public function allocationPreview(ProjectPhase $phase, array $data, ?int $id = null): array
    {
        $start = CarbonImmutable::parse($data['starts_at']);
        $end = CarbonImmutable::parse($data['ends_at']);
        $conflicts = [];
        if ($start->lt($phase->starts_at) || $end->gt($phase->ends_at)) {
            $conflicts[] = 'Keep the allocation within the phase dates.';
        }
        $sameKind = $phase->allocations()->where('operational_asset_id', $data['operational_asset_id'])
            ->where('kind', $data['kind'])->when($id !== null, fn ($q) => $q->where('id', '<>', $id))
            ->where('starts_at', '<', $end)->where('ends_at', '>', $start)->exists();
        if ($sameKind) {
            $conflicts[] = 'This asset already has an overlapping allocation of this type in the phase.';
        }
        $assessment = $this->availability->assess(new AssetUsageRequest(
            (int) $data['operational_asset_id'], AssetUsageType::DispatchAssign, $start, $end,
            source: new AssetUsageSource('project_phase', (int) $phase->id),
            excludedAssignmentIds: $phase->shifts()->with('job.assetAssignments')->get()->flatMap(fn ($s) => $s->job->assetAssignments->pluck('id'))->all(),
        ));
        foreach ($assessment->conflicts as $conflict) {
            // Maintenance may target an unsafe asset, but cannot displace another commitment.
            if ($data['kind'] === 'maintenance' && in_array($conflict->code, ['asset.not_dispatchable', 'asset.maintenance_block', 'asset.inspection_required'], true)) {
                continue;
            }
            $conflicts[] = $conflict->message;
        }
        $shifts = $phase->shifts()->with('job')->get();
        $affected = [];
        foreach ($shifts as $shift) {
            $job = $shift->job;
            if ($job->trashed() || in_array($job->status->value, ['completed', 'cancelled'], true)) {
                continue;
            }
            $affected[] = ['id' => $job->id, 'reference' => $job->reference];
            if (! in_array($job->status->value, ['draft', 'pending_approval', 'scheduled'], true)) {
                $conflicts[] = 'An active shift uses this phase. Finish or cancel it before changing allocations.';
            }
        }

        return ['conflicts' => array_values(array_unique($conflicts)), 'affected_shifts' => $affected, 'approval' => 'This changes the baseline. Independent approval and crew reconfirmation are required before affected shifts can dispatch.'];
    }

    /** @param array<string, mixed> $data */
    public function saveAllocation(User $actor, ProjectPlan $plan, int $phaseId, array $data, ?int $id = null): void
    {
        $this->change($actor, $plan, (int) $data['version'], 'project_plan.allocation_changed', function (ProjectPlan $locked) use ($actor, $phaseId, $data, $id) {
            $phase = $this->phase($locked, $phaseId);
            $allocation = $id === null ? new ProjectAllocation(['project_phase_id' => $phase->id]) : $phase->allocations()->whereKey($id)->firstOrFail();
            $this->availability->lockAssetsForUpdate(array_filter([(int) $data['operational_asset_id'], $allocation->operational_asset_id]));
            $preview = $this->allocationPreview($phase, $data, $id);
            if ($preview['conflicts'] !== []) {
                throw ValidationException::withMessages(['allocation' => $preview['conflicts']]);
            }
            $before = $allocation->exists ? $allocation->toArray() : null;
            $allocation->fill([
                'operational_asset_id' => $data['operational_asset_id'], 'kind' => $data['kind'],
                'starts_at' => $data['starts_at'], 'ends_at' => $data['ends_at'], 'notes' => $data['notes'] ?? null,
            ])->save();
            $this->audit->handle($actor, $allocation, 'project_allocation.saved', $before, $allocation->toArray());
        });
    }

    public function submit(User $actor, ProjectPlan $plan, int $version): void
    {
        $this->change($actor, $plan, $version, 'project_plan.submitted', function (ProjectPlan $locked) use ($actor) {
            if (! $locked->phases()->exists()) {
                throw ValidationException::withMessages(['plan' => 'Add at least one phase before submitting the baseline.']);
            }
            $locked->status = 'pending';
            $locked->submitted_by = $actor->id;
            $locked->approved_version = null;
        }, false);
    }

    public function decide(User $actor, ProjectPlan $plan, int $version, string $decision, string $reason): void
    {
        abort_unless(PlanningAccess::approve($actor), 403);
        DB::transaction(function () use ($actor, $plan, $version, $decision, $reason) {
            $locked = ProjectPlan::query()->lockForUpdate()->findOrFail($plan->id);
            $this->assertVersion($locked, $version);
            abort_if(in_array($actor->id, [$locked->created_by, $locked->submitted_by], true), 403);
            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages(['plan' => 'Only a submitted baseline can be decided.']);
            }
            // Re-evaluate reservations at decision time; previews are advisory.
            if ($decision === 'approved') {
                $phases = $locked->phases()->with('allocations')->get();
                $this->availability->lockAssetsForUpdate($phases->flatMap(fn ($p) => $p->allocations->pluck('operational_asset_id'))->all());
                foreach ($phases as $phase) {
                    foreach ($phase->allocations as $allocation) {
                        $preview = $this->allocationPreview($phase, $allocation->toArray(), $allocation->id);
                        if ($preview['conflicts'] !== []) {
                            throw ValidationException::withMessages(['plan' => $preview['conflicts']]);
                        }
                    }
                }
            }
            $before = $locked->toArray();
            $locked->update(['status' => $decision, 'version' => $version + 1, 'approved_version' => $decision === 'approved' ? $version + 1 : null, 'approved_by' => $decision === 'approved' ? $actor->id : null, 'approved_at' => $decision === 'approved' ? now() : null, 'decision_reason' => $reason]);
            $this->audit->handle($actor, $locked, 'project_plan.'.$decision, $before, $locked->toArray(), $reason);
        });
    }
}
