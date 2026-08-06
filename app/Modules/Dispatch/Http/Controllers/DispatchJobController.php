<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Assignment\ViewModels\DispatchAssignmentWorkspaceViewModel;
use App\Modules\Dispatch\Actions\ConvertServiceRequestToDispatch;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Http\Requests\StoreDispatchJobRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\ViewModels\DispatchActivationWorkspaceViewModel;
use App\Modules\Dispatch\ViewModels\DispatchFieldProgressionViewModel;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Models\OperationalAsset;
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
                'cancel' => Gate::forUser($user)->allows('cancel', $job),
                'reopen' => Gate::forUser($user)->allows('reopen', $job),
                'archive' => Gate::forUser($user)->allows('archive', $job),
                'restore' => Gate::forUser($user)->allows('restore', $job),
                'request_gpt_assistance' => $user->can(PermissionName::GptUseDispatch->value) || $user->can(PermissionName::GptUseOperations->value),
            ],
        ]);
    }
}
