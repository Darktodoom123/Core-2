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
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Http\Requests\StoreDispatchJobRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\ViewModels\DispatchFieldProgressionViewModel;
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
                    ->with('asset:id,code,name'),
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

        if (isset($validated['service_request_id'])) {
            $job = $convert->handle(
                (int) $validated['service_request_id'],
                $request->user(),
                [
                    'reference' => $validated['reference'],
                    'scheduled_start' => $validated['scheduled_start'],
                    'scheduled_end' => $validated['scheduled_end'],
                ],
            );
        } else {
            $job = $manual->handle($request->user(), $validated);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was created.",
        ]);
    }

    public function show(
        int $dispatchJob,
        ListDispatchCandidatesRequest $filters,
        DispatchActivationReadinessQuery $readiness,
        PersonnelCandidateQuery $personnelCandidates,
        AssetCandidateQuery $assetCandidates,
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
                    ->with('asset:id,code,name,kind,status,deleted_at'),
                'source',
                'serviceRequest:id,reference',
                'approvals',
            ])
            ->findOrFail($dispatchJob);
        Gate::authorize('view', $job);

        $canAssignResources = Gate::forUser($user)->allows('assignResources', $job)
            && $job->scheduled_start !== null
            && $job->scheduled_end !== null
            && in_array($job->status, [
                DispatchStatus::Draft,
                DispatchStatus::PendingApproval,
                DispatchStatus::Scheduled,
            ], true);
        $canUpdateOwnStatus = Gate::forUser($user)->allows('updateOwnStatus', $job);

        $canRespondAssignment = $job->personnelAssignments->contains(
            fn (DispatchPersonnelAssignment $assignment): bool => Gate::forUser($user)->allows('respond', $assignment),
        );

        return Inertia::render('dispatch-detail', [
            'job' => OperationsWorkspaceViewModel::job($job),
            'personnel_candidates' => $canViewCandidates
                ? Inertia::defer(fn (): array => $this->rescueCandidatePage(
                    fn (): CandidatePage => $personnelCandidates->page($job, $filters),
                    $job,
                    'personnel',
                ), 'dispatch-candidates')
                : [],
            'asset_candidates' => $canViewCandidates
                ? Inertia::defer(fn (): array => $this->rescueCandidatePage(
                    fn (): CandidatePage => $assetCandidates->page($job, $filters),
                    $job,
                    'assets',
                ), 'dispatch-candidates')
                : [],
            'activation' => $readiness->make($job),
            'progression' => $canUpdateOwnStatus
                ? DispatchFieldProgressionViewModel::make($job)
                : null,
            'capabilities' => [
                'assign_resources' => $canAssignResources,
                'reassign_resources' => Gate::forUser($user)->allows('reassignResources', $job),
                'view_assignment_candidates' => $canViewCandidates,
                'activate' => Gate::forUser($user)->allows('activate', $job),
                'update_own_status' => $canUpdateOwnStatus,
                'respond_assignment' => $canRespondAssignment,
                'cancel' => Gate::forUser($user)->allows('cancel', $job),
                'reopen' => Gate::forUser($user)->allows('reopen', $job),
                'archive' => Gate::forUser($user)->allows('archive', $job),
                'restore' => Gate::forUser($user)->allows('restore', $job),
                'request_gpt_assistance' => $user->can(PermissionName::GptUseDispatch->value) || $user->can(PermissionName::GptUseOperations->value),
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
