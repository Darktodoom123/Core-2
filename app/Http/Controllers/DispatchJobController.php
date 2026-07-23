<?php

namespace App\Http\Controllers;

use App\Actions\ConvertServiceRequestToDispatch;
use App\Actions\RecordAuditEvent;
use App\Enums\DispatchStatus;
use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Http\Requests\StoreDispatchJobRequest;
use App\Models\DispatchJob;
use App\Models\OperationalAsset;
use App\Models\User;
use App\Services\DispatchResourceEligibility;
use App\ViewModels\DispatchAssignmentWorkspaceViewModel;
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

        return response()->json(['data' => DispatchJob::query()->visibleTo(request()->user())->with(['personnelAssignments', 'assetAssignments.asset'])->latest('scheduled_start')->paginate(25)]);
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
        $job = DispatchJob::query()
            ->visibleTo($user)
            ->with(['personnelAssignments.user', 'assetAssignments.asset', 'approvals'])
            ->findOrFail($dispatchJob);
        Gate::authorize('view', $job);

        $canViewCandidates = $user->can(PermissionName::AssignmentsViewAll->value);
        $canAssignResources = Gate::forUser($user)->allows('assignResources', $job)
            && $job->scheduled_start !== null
            && $job->scheduled_end !== null
            && in_array($job->status, [
                DispatchStatus::Draft,
                DispatchStatus::PendingApproval,
                DispatchStatus::Scheduled,
            ], true);

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

        return Inertia::render('dispatch-detail', [
            'job' => OperationsWorkspaceViewModel::job($job),
            'personnel_candidates' => DispatchAssignmentWorkspaceViewModel::personnelCandidates($personnel, $job, $eligibility),
            'asset_candidates' => DispatchAssignmentWorkspaceViewModel::assetCandidates($assets, $job, $eligibility),
            'capabilities' => [
                'assign_resources' => $canAssignResources,
                'view_assignment_candidates' => $canViewCandidates,
            ],
        ]);
    }
}
