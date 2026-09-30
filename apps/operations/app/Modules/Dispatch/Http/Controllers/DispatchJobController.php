<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Data\CandidatePage;
use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Assignment\Queries\AssetCandidateQuery;
use App\Modules\Assignment\Queries\DispatchActivationReadinessQuery;
use App\Modules\Assignment\Queries\PersonnelCandidateQuery;
use App\Modules\Dispatch\Actions\ConvertServiceRequestToDispatch;
use App\Modules\Dispatch\Actions\CreateManualDispatchHandoff;
use App\Modules\Dispatch\Actions\UpdateDispatchResourceRequirements;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Http\Requests\StoreDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\UpdateDispatchResourceRequirementsRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Modules\Dispatch\Planning\Services\PlanningAccess;
use App\Modules\Dispatch\Support\DispatchScheduleUrl;
use App\Modules\Dispatch\ViewModels\DispatchExecutionViewModel;
use App\Modules\Dispatch\ViewModels\DispatchFieldProgressionViewModel;
use App\Platform\Gpt\Services\BlockerAdviceReview;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

final class DispatchJobController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', DispatchJob::class);
        $user = request()->user();
        $canViewAllAssignments = $user->can(PermissionName::AssignmentsViewAll->value);
        $jobs = DispatchJob::query()
            ->visibleTo($user)
            ->with([
                'personnelAssignments' => fn ($query) => $query
                    ->whereNull('active_until')
                    ->when(
                        ! $canViewAllAssignments,
                        fn ($assignment) => $assignment->where('user_id', $user->id),
                    )
                    ->with('user:id,name'),
                'assetAssignments' => fn ($query) => $query
                    ->whereNull('active_until')
                    ->with('asset:id,code,name,kind,subtype,specifications,rated_capacity,capacity_unit,status,deleted_at'),
                'source',
                'serviceRequest:id,reference',
            ])
            ->latest('scheduled_start')
            ->paginate(25)
            ->through(static fn (DispatchJob $job): array => OperationsWorkspaceViewModel::job($job));

        return response()->json(['data' => $jobs]);
    }

    public function store(
        StoreDispatchJobRequest $request,
        ConvertServiceRequestToDispatch $convert,
        CreateManualDispatchHandoff $manual,
    ): RedirectResponse {
        $validated = $request->validated();
        $scheduleDate = $validated['schedule_date'] ?? null;
        unset($validated['open_schedule'], $validated['schedule_date']);

        if (isset($validated['service_request_id'])) {
            $job = $convert->handle(
                (int) $validated['service_request_id'],
                $request->user(),
                [
                    'reference' => $validated['reference'] ?? null,
                    'scheduled_start' => $validated['scheduled_start'],
                    'scheduled_end' => $validated['scheduled_end'],
                ],
            );
        } else {
            $job = $manual->handle($request->user(), $validated);
        }

        $flash = [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was created.",
        ];

        if ($request->boolean('open_schedule')) {
            return redirect(DispatchScheduleUrl::for($job, $scheduleDate))->with('flash', $flash);
        }

        return back()->with('flash', $flash);
    }

    public function show(
        int $dispatchJob,
        ListDispatchCandidatesRequest $filters,
        DispatchActivationReadinessQuery $readiness,
        PersonnelCandidateQuery $personnelCandidates,
        AssetCandidateQuery $assetCandidates,
        BlockerAdviceReview $adviceReview,
    ): Response {
        $user = request()->user();
        $canViewCandidates = $user->can(PermissionName::AssignmentsViewAll->value);
        $job = DispatchJob::query()
            ->visibleTo($user)
            ->with([
                'personnelAssignments' => fn ($query) => $query
                    ->whereNull('active_until')
                    ->when(
                        ! $canViewCandidates,
                        fn ($assignment) => $assignment->where('user_id', $user->id),
                    )
                    ->with([
                        'user.roles:id,name',
                        'user.personnelProfile',
                        'user.personnelCredentials',
                        'user.dispatchAssignments' => fn ($query) => $query
                            ->where(function ($assignment): void {
                                $assignment->whereNull('active_until')->orWhere('active_until', '>', now());
                            })
                            ->with('job:id,reference,scheduled_start,scheduled_end'),
                    ]),
                'assetAssignments' => fn ($query) => $query
                    ->whereNull('active_until')
                    ->with('asset:id,code,name,kind,subtype,specifications,rated_capacity,capacity_unit,status,deleted_at'),
                'source',
                'serviceRequest:id,reference',
                'approvals',
            ])
            ->findOrFail($dispatchJob);
        Gate::authorize('view', $job);

        $projectShift = ProjectShift::query()->with('phase.plan')->where('dispatch_job_id', $job->id)->first();

        $canAssignResources = Gate::forUser($user)->allows('assignResources', $job)
            && $projectShift === null
            && $job->scheduled_start !== null
            && $job->scheduled_end !== null
            && in_array($job->status, [
                DispatchStatus::Draft,
                DispatchStatus::PendingApproval,
                DispatchStatus::Scheduled,
            ], true);
        $canUpdateOwnStatus = Gate::forUser($user)->allows('updateOwnStatus', $job);
        $isOfficeExecution = ! $canUpdateOwnStatus && DispatchExecutionViewModel::appliesTo($job);

        $canRespondAssignment = $job->personnelAssignments->contains(
            fn (DispatchPersonnelAssignment $assignment): bool => Gate::forUser($user)->allows('respond', $assignment),
        );

        $adviceId = request()->integer('advice_id');
        $optionId = request()->integer('option_id');
        $advicePrefill = $adviceId > 0 && $optionId > 0 && (bool) config('services.openai.blocker_resolution_enabled', false)
            ? $adviceReview->prefill($user, $job, $adviceId, $optionId)
            : null;

        return Inertia::render('dispatch-detail', [
            'advice_prefill' => $advicePrefill,
            'advice_notice' => $adviceId > 0 && $advicePrefill === null ? 'That suggestion is no longer current. Review available resources manually.' : null,
            'project_context' => $projectShift !== null && PlanningAccess::view($user) ? [
                'name' => $projectShift->phase->plan->name,
                'phase' => $projectShift->phase->name,
                'return_url' => '/?view=dispatch&dispatch_tab=project-plans&project='.$projectShift->phase->project_plan_id.'&phase='.$projectShift->project_phase_id.'&crew_week='.$job->scheduled_start?->toDateString(),
            ] : null,
            'job' => OperationsWorkspaceViewModel::job($job),
            'personnel_candidates' => $canViewCandidates
                ? ($isOfficeExecution
                    ? $this->rescueCandidatePage(
                        fn (): CandidatePage => $personnelCandidates->page($job, $filters),
                        $job,
                        'personnel',
                    )
                    : Inertia::defer(fn (): array => $this->rescueCandidatePage(
                        fn (): CandidatePage => $personnelCandidates->page($job, $filters),
                        $job,
                        'personnel',
                    ), 'dispatch-candidates'))
                : [],
            'asset_candidates' => $canViewCandidates
                ? ($isOfficeExecution
                    ? $this->rescueCandidatePage(
                        fn (): CandidatePage => $assetCandidates->page($job, $filters),
                        $job,
                        'assets',
                    )
                    : Inertia::defer(fn (): array => $this->rescueCandidatePage(
                        fn (): CandidatePage => $assetCandidates->page($job, $filters),
                        $job,
                        'assets',
                    ), 'dispatch-candidates'))
                : [],
            'activation' => $readiness->make($job),
            'progression' => $canUpdateOwnStatus
                ? DispatchFieldProgressionViewModel::make($job)
                : null,
            'execution' => $isOfficeExecution
                ? DispatchExecutionViewModel::make($job, $user)
                : null,
            'capabilities' => [
                'assign_resources' => $canAssignResources,
                'reassign_resources' => $projectShift === null && Gate::forUser($user)->allows('reassignResources', $job),
                'view_assignment_candidates' => $canViewCandidates,
                'activate' => Gate::forUser($user)->allows('activate', $job),
                'update_requirements' => $projectShift === null && $job->source_type === null && Gate::forUser($user)->allows('update', $job),
                'update_own_status' => $canUpdateOwnStatus,
                'respond_assignment' => $canRespondAssignment,
                'cancel' => Gate::forUser($user)->allows('cancel', $job),
                'reopen' => Gate::forUser($user)->allows('reopen', $job),
                'archive' => Gate::forUser($user)->allows('archive', $job),
                'restore' => Gate::forUser($user)->allows('restore', $job),
                'request_gpt_assistance' => ! config('services.openai.blocker_resolution_enabled', false)
                    && ($user->can(PermissionName::GptUseDispatch->value) || $user->can(PermissionName::GptUseOperations->value)),
                'blocker_resolution_enabled' => (bool) config('services.openai.blocker_resolution_enabled', false),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function rescueCandidatePage(callable $query, DispatchJob $job, string $resource): array
    {
        request()->attributes->set('workspace_inertia_mode', 'deferred');

        try {
            /** @var CandidatePage<array<string, mixed>> $page */
            $page = $query();

            request()->attributes->set('candidate_page_size', $page->pagination['per_page']);
            request()->attributes->set('candidate_result_count', count($page->data));
            request()->attributes->set('candidate_resource', $resource);

            return $page->toArray();
        } catch (Throwable $exception) {
            Log::warning('dispatch.candidate_deferred_failed', [
                'resource' => $resource,
                'exception' => $exception::class,
            ]);

            return CandidatePage::error($job, 'Candidate data is temporarily unavailable. Retry to evaluate it again.')->toArray();
        }
    }

    public function updateSiteCoordinates(Request $request, DispatchJob $dispatchJob): RedirectResponse
    {
        Gate::authorize('update', $dispatchJob);

        $validated = $request->validate([
            'site_latitude' => ['required', 'numeric', 'between:-90,90'],
            'site_longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $dispatchJob->update([
            'site_latitude' => $validated['site_latitude'],
            'site_longitude' => $validated['site_longitude'],
        ]);

        return back()->with('success', 'Project site coordinates updated successfully.');
    }

    public function updateResourceRequirements(
        UpdateDispatchResourceRequirementsRequest $request,
        DispatchJob $dispatchJob,
        UpdateDispatchResourceRequirements $update,
    ): RedirectResponse {
        $validated = $request->validated();
        $update->handle(
            $request->user(),
            $dispatchJob,
            (int) $validated['version'],
            $validated['resource_requirements'],
        );

        return back()->with('flash', [
            'tone' => 'success',
            'message' => 'Required crew and equipment were updated.',
        ]);
    }

    public function updatePlannedCraneSlots(Request $request, DispatchJob $dispatchJob): RedirectResponse
    {
        Gate::authorize('update', $dispatchJob);

        $validated = $request->validate([
            'planned_crane_slots' => ['required', 'array'],
            'planned_crane_slots.*.slot_key' => ['required', 'string', 'max:50'],
            'planned_crane_slots.*.name' => ['required', 'string', 'max:100'],
            'planned_crane_slots.*.required_type' => ['nullable', 'string', 'max:50'],
            'planned_crane_slots.*.jib_radius_meters' => ['required', 'numeric', 'min:10', 'max:150'],
            'planned_crane_slots.*.site_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'planned_crane_slots.*.site_longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        /** @var list<array<string, mixed>> $slots */
        $slots = $validated['planned_crane_slots'];

        /** @var array<string, mixed>|null $firstSlotWithCoords */
        $firstSlotWithCoords = collect($slots)->first(static fn (array $s): bool => ! empty($s['site_latitude']) && ! empty($s['site_longitude']));

        $updates = ['planned_crane_slots' => $slots];
        if ($firstSlotWithCoords !== null && ($dispatchJob->site_latitude === null || $dispatchJob->site_longitude === null)) {
            $updates['site_latitude'] = $firstSlotWithCoords['site_latitude'];
            $updates['site_longitude'] = $firstSlotWithCoords['site_longitude'];
        }

        $dispatchJob->update($updates);

        return back()->with('success', 'Planned crane positions and site layout updated successfully.');
    }

    public function updateAssetSiteCoordinates(Request $request, DispatchJob $dispatchJob, DispatchAssetAssignment $assetAssignment): RedirectResponse
    {
        Gate::authorize('update', $dispatchJob);

        abort_unless($assetAssignment->dispatch_job_id === $dispatchJob->id, 404);

        $validated = $request->validate([
            'site_latitude' => ['required', 'numeric', 'between:-90,90'],
            'site_longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $assetAssignment->update([
            'site_latitude' => $validated['site_latitude'],
            'site_longitude' => $validated['site_longitude'],
        ]);

        return back()->with('success', 'Asset crane anchor coordinates updated successfully.');
    }
}
