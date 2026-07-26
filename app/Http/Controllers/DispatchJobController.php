<?php

namespace App\Http\Controllers;

use App\Actions\ConvertServiceRequestToDispatch;
use App\Actions\RecordAuditEvent;
use App\Enums\DispatchStatus;
use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Http\Requests\StoreDispatchJobRequest;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\OperationalAsset;
use App\Models\User;
use App\Services\DispatchResourceEligibility;
use App\ViewModels\DispatchActivationWorkspaceViewModel;
use App\ViewModels\DispatchAssignmentWorkspaceViewModel;
use App\ViewModels\DispatchFieldProgressionViewModel;
use App\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

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
            ])
            ->latest('scheduled_start')
            ->paginate(25)
            ->through(static fn (DispatchJob $job): array => OperationsWorkspaceViewModel::job($job));

        return response()->json(['data' => $jobs]);
    }

    public function store(
        StoreDispatchJobRequest $request,
        ConvertServiceRequestToDispatch $convert,
        RecordAuditEvent $audit,
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
            $job = DispatchJob::query()->create([
                ...$validated,
                'status' => DispatchStatus::Draft,
                'created_by' => $request->user()->id,
            ]);
            $audit->handle($request->user(), $job, 'dispatch.created', null, $job->toArray());
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was created.",
        ]);
    }

    public function show(int $dispatchJob, DispatchResourceEligibility $eligibility): Response
    {
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
                    ->with('user'),
                'assetAssignments' => fn ($query) => $query
                    ->whereNull('active_until')
                    ->with('asset.maintenanceWorkOrders'),
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

        $personnel = $canViewCandidates
            ? User::query()
                ->whereHas('roles', fn ($query) => $query->whereIn('name', [
                    RoleName::Driver->value,
                    RoleName::CraneOperator->value,
                    RoleName::FieldTechnician->value,
                ]))
                ->with([
                    'roles:id,name',
                    'personnelProfile',
                    'personnelCredentials',
                    'dispatchAssignments' => fn ($query) => $query
                        ->whereNull('active_until')
                        ->with('job'),
                ])
                ->orderBy('name')
                ->limit(200)
                ->get()
            : collect();
        $assets = $canViewCandidates
            ? OperationalAsset::query()
                ->whereIn('kind', ['truck', 'crane', 'equipment'])
                ->with([
                    'maintenanceWorkOrders' => fn ($query) => $query
                        ->where('dispatch_blocking', true)
                        ->whereNull('released_at'),
                    'assignments' => fn ($query) => $query
                        ->whereNull('active_until')
                        ->with('job'),
                ])
                ->orderBy('code')
                ->limit(200)
                ->get()
            : collect();

        $canRespondAssignment = $job->personnelAssignments->contains(
            fn (DispatchPersonnelAssignment $assignment): bool => Gate::forUser($user)->allows('respond', $assignment),
        );

        return Inertia::render('dispatch-detail', [
            'job' => OperationsWorkspaceViewModel::job($job),
            'personnel_candidates' => DispatchAssignmentWorkspaceViewModel::personnelCandidates($personnel, $job, $eligibility),
            'asset_candidates' => DispatchAssignmentWorkspaceViewModel::assetCandidates($assets, $job, $eligibility),
            'activation' => DispatchActivationWorkspaceViewModel::make($job),
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
            ],
        ]);
    }
}
