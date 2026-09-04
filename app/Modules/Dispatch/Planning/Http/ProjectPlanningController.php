<?php

namespace App\Modules\Dispatch\Planning\Http;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Modules\Dispatch\Planning\Services\PlanningAccess;
use App\Modules\Dispatch\Planning\Services\ProjectPlanService;
use App\Modules\Dispatch\Planning\Services\ProjectShiftService;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class ProjectPlanningController extends Controller
{
    public function store(PlanningRequest $request, ProjectPlanService $plans): RedirectResponse
    {
        $plan = $plans->create($request->user(), $request->validated());

        return redirect('/?view=dispatch&dispatch_tab=project-plans&project='.$plan->id)->with('flash', ['tone' => 'success', 'message' => 'Project dispatch plan created. Add its phases and reservations.']);
    }

    public function phase(PlanningRequest $request, ProjectPlan $projectPlan, ProjectPlanService $plans, ?int $phase = null): RedirectResponse
    {
        $plans->savePhase($request->user(), $projectPlan, $request->validated(), $phase);

        return $this->saved('Phase saved. Submit the updated baseline for approval.');
    }

    public function allocation(PlanningRequest $request, ProjectPlan $projectPlan, int $phase, ProjectPlanService $plans, ?int $allocation = null): RedirectResponse
    {
        $plans->saveAllocation($request->user(), $projectPlan, $phase, $request->validated(), $allocation);

        return $this->saved('Allocation saved. Baseline approval is required before dispatch.');
    }

    public function preview(PlanningRequest $request, ProjectPlan $projectPlan, int $phase, ProjectPlanService $plans, ?int $allocation = null): JsonResponse
    {
        $plans->assertVersion($projectPlan, (int) $request->validated('version'));
        $model = $plans->phase($projectPlan, $phase);
        if ($allocation !== null) {
            $model->allocations()->whereKey($allocation)->firstOrFail();
        }

        return response()->json($plans->allocationPreview($model, $request->validated(), $allocation));
    }

    public function submit(PlanningRequest $request, ProjectPlan $projectPlan, ProjectPlanService $plans): RedirectResponse
    {
        $plans->submit($request->user(), $projectPlan, (int) $request->validated('version'));

        return $this->saved('Baseline submitted for independent Operations approval.');
    }

    public function decision(PlanningRequest $request, ProjectPlan $projectPlan, ProjectPlanService $plans): RedirectResponse
    {
        $plans->decide($request->user(), $projectPlan, (int) $request->validated('version'), $request->validated('decision'), $request->validated('reason'));

        return $this->saved('Baseline decision recorded.');
    }

    public function shifts(PlanningRequest $request, ProjectPlan $projectPlan, int $phase, ProjectShiftService $shifts): RedirectResponse
    {
        $shifts->generate($request->user(), $projectPlan, $phase, $request->validated());

        return $this->saved('Shift dispatches created. Fill the required crew coverage.');
    }

    public function roster(PlanningRequest $request, ProjectPlan $projectPlan, int $shift, ProjectShiftService $shifts): RedirectResponse
    {
        $shifts->roster($request->user(), $projectPlan, $shift, $request->validated());

        return $this->saved('Crew change saved. Locked-shift changes require independent approval.');
    }

    public function shiftDecision(PlanningRequest $request, ProjectPlan $projectPlan, int $shift, ProjectShiftService $shifts): RedirectResponse
    {
        $shifts->decide($request->user(), $projectPlan, $shift, $request->validated());

        return $this->saved('Shift exception decision recorded.');
    }

    public function candidates(Request $request, ProjectPlan $projectPlan, int $shift, DispatchResourceEligibility $eligibility): JsonResponse
    {
        abort_unless(PlanningAccess::view($request->user()), 403);
        $validated = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'role' => ['required', 'in:driver,crane_operator,rigger'], 'page' => ['sometimes', 'integer', 'min:1']]);
        $model = ProjectShift::query()->whereHas('phase', fn ($q) => $q->where('project_plan_id', $projectPlan->id))->with('job')->findOrFail($shift);
        $role = $validated['role'];
        $page = User::query()->role($role === 'driver' ? 'crane_operator' : $role)
            ->when($validated['search'] ?? null, fn ($q, $search) => $q->where('name', 'like', '%'.$search.'%'))
            ->with(['roles', 'personnelProfile', 'personnelCredentials', 'dispatchAssignments' => fn ($q) => $q->whereNull('active_until')->with('job')])
            ->orderBy('name')->paginate(25);
        $page->through(function (User $user) use ($role, $model, $eligibility) {
            $assessment = $eligibility->personnel($user, $role, $model->job, true);

            return ['id' => $user->id, 'name' => $user->name, 'role' => $role, 'eligible' => $assessment['eligible'], 'reasons' => $assessment['reasons'], 'credential' => $assessment['credential'], 'commitments' => $user->dispatchAssignments->filter(fn (DispatchPersonnelAssignment $a): bool => $a->job->scheduled_end?->gt(now()) === true)->map(fn ($a) => ['start' => $a->job->scheduled_start?->toIso8601String(), 'end' => $a->job->scheduled_end?->toIso8601String(), 'reference' => $a->job->reference])->values()->all()];
        });

        return response()->json($page);
    }

    private function saved(string $message): RedirectResponse
    {
        return back()->with('flash', ['tone' => 'success', 'message' => $message]);
    }
}
