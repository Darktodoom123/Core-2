<?php

namespace App\Http\Controllers;

use App\Enums\PermissionName;
use App\Models\ApprovalRequest;
use App\Models\AuditEvent;
use App\Models\DispatchJob;
use App\Models\FuelRequest;
use App\Models\OperationalAsset;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

final class OperationsWorkspaceController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $jobs = Gate::forUser($user)->allows('viewAny', DispatchJob::class)
            ? DispatchJob::query()->visibleTo($user)->with(['personnelAssignments.user:id,name', 'assetAssignments.asset:id,code,name'])->orderBy('scheduled_start')->limit(100)->get()
            : collect();
        $assets = Gate::forUser($user)->allows('viewAny', OperationalAsset::class)
            ? OperationalAsset::query()->visibleTo($user)->withCount(['maintenanceWorkOrders as blocking_work_orders_count' => fn ($query) => $query->where('dispatch_blocking', true)->whereNull('released_at')])->orderBy('code')->limit(100)->get()
            : collect();
        $fuelRequests = Gate::forUser($user)->allows('viewAny', FuelRequest::class)
            ? FuelRequest::query()->visibleTo($user)->with(['requester:id,name', 'asset:id,code'])->latest()->limit(100)->get()
            : collect();

        return Inertia::render('workspace', [
            'jobs' => $jobs,
            'assets' => $assets,
            'fuelRequests' => $fuelRequests,
            'approvals' => $user->can(PermissionName::AssignmentsApprove->value) || $user->can(PermissionName::DispatchApprovePriority->value)
                ? ApprovalRequest::query()->with('subject')->where('status', 'pending')->latest()->limit(100)->get() : [],
            'users' => $user->can(PermissionName::UsersManage->value)
                ? User::query()->with('roles:id,name')->orderBy('name')->limit(100)->get() : [],
            'auditEvents' => $user->can(PermissionName::AuditView->value)
                ? AuditEvent::query()->with('actor:id,name')->latest('occurred_at')->limit(100)->get() : [],
        ]);
    }
}
