<?php

namespace App\Http\Controllers;

use App\Enums\PermissionName;
use App\Models\ApprovalRequest;
use App\Models\AuditEvent;
use App\Models\Client;
use App\Models\DispatchJob;
use App\Models\FuelRequest;
use App\Models\OperationalAsset;
use App\Models\ServiceRequest;
use App\Models\User;
use App\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

final class OperationsWorkspaceController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $canCreateDispatch = $user->can(PermissionName::DispatchCreate->value);
        $canViewAllAssignments = $user->can(PermissionName::AssignmentsViewAll->value);

        $jobs = Gate::forUser($user)->allows('viewAny', DispatchJob::class)
            ? DispatchJob::query()
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
                ->orderBy('scheduled_start')
                ->limit(100)
                ->get()
            : collect();
        $assets = Gate::forUser($user)->allows('viewAny', OperationalAsset::class)
            ? OperationalAsset::query()->visibleTo($user)->withCount(['maintenanceWorkOrders as blocking_work_orders_count' => fn ($query) => $query->where('dispatch_blocking', true)->whereNull('released_at')])->orderBy('code')->limit(100)->get()
            : collect();
        $fuelRequests = Gate::forUser($user)->allows('viewAny', FuelRequest::class)
            ? FuelRequest::query()->visibleTo($user)->with(['requester:id,name', 'asset:id,code'])->latest()->limit(100)->get()
            : collect();
        $approvalKinds = array_values(array_filter([
            $user->can(PermissionName::AssignmentsApprove->value) ? 'assignment_override' : null,
            $user->can(PermissionName::DispatchApprovePriority->value) ? 'dispatch_activation' : null,
        ]));
        $approvals = $approvalKinds !== []
            ? ApprovalRequest::query()
                ->with([
                    'requester:id,name',
                    'subject',
                ])
                ->whereIn('kind', $approvalKinds)
                ->where('status', 'pending')
                ->latest()
                ->limit(100)
                ->get()
                ->loadMorph('subject', [
                    DispatchJob::class => [
                        'personnelAssignments.user:id,name',
                        'assetAssignments.asset:id,code,name',
                    ],
                ])
            : collect();
        $users = $user->can(PermissionName::UsersManage->value)
            ? User::query()->with('roles:id,name')->orderBy('name')->limit(100)->get()
            : collect();
        $auditEvents = $user->can(PermissionName::AuditView->value)
            ? AuditEvent::query()->with('actor:id,name')->latest('occurred_at')->limit(100)->get()
            : collect();
        $clients = $canCreateDispatch
            ? Client::query()->where('status', 'active')->orderBy('company_name')->limit(200)->get()
            : collect();
        $serviceRequests = $canCreateDispatch
            ? ServiceRequest::query()
                ->with('client:id,code,company_name')
                ->withCount('dispatchJobs')
                ->whereIn('status', ['submitted', 'dispatching'])
                ->orderByRaw('scheduled_date is null')
                ->orderBy('scheduled_date')
                ->latest('created_at')
                ->limit(100)
                ->get()
            : collect();

        return Inertia::render('workspace', [
            'jobs' => OperationsWorkspaceViewModel::jobs($jobs),
            'clients' => OperationsWorkspaceViewModel::clients($clients),
            'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($serviceRequests),
            'assets' => OperationsWorkspaceViewModel::assets($assets),
            'fuelRequests' => OperationsWorkspaceViewModel::fuelRequests($fuelRequests),
            'approvals' => OperationsWorkspaceViewModel::approvals($approvals, $user),
            'users' => OperationsWorkspaceViewModel::users($users),
            'auditEvents' => OperationsWorkspaceViewModel::auditEvents($auditEvents),
            'navigation' => OperationsWorkspaceViewModel::navigation($user),
            'capabilities' => OperationsWorkspaceViewModel::capabilities($user),
            'workspace' => [
                'refreshed_at' => now()->toIso8601String(),
                'stale_after_seconds' => 120,
            ],
        ]);
    }
}
