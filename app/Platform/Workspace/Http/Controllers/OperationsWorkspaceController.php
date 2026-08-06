<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Models\Notification;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Models\ReportExport;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

        return Inertia::render('workspace', [
            'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
            'clients' => OperationsWorkspaceViewModel::clients($this->fetchClients($canCreateDispatch)),
            'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($this->fetchServiceRequests($canCreateDispatch)),
            'assets' => OperationsWorkspaceViewModel::assets($this->fetchAssets($user)),
            'fuelRequests' => OperationsWorkspaceViewModel::fuelRequests($this->fetchFuelRequests($user)),
            'locations' => OperationsWorkspaceViewModel::locations($this->fetchLocations($user)),
            'approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user),
            'users' => OperationsWorkspaceViewModel::users($this->fetchUsers($user)),
            'auditEvents' => OperationsWorkspaceViewModel::auditEvents($this->fetchAuditEvents($user)),
            'gptRecommendations' => OperationsWorkspaceViewModel::gptRecommendations($this->fetchGptRecommendations($user)),
            'jobReports' => OperationsWorkspaceViewModel::jobReports($this->fetchJobReports($user)),
            'reportExports' => OperationsWorkspaceViewModel::reportExports($this->fetchReportExports($user)),
            'notifications' => OperationsWorkspaceViewModel::notifications($this->fetchNotifications($user)),
            'archivedJobs' => OperationsWorkspaceViewModel::archivedJobs($this->fetchArchivedJobs($user)),
            'navigation' => OperationsWorkspaceViewModel::navigation($user),
            'capabilities' => OperationsWorkspaceViewModel::capabilities($user),
            'workspace' => [
                'refreshed_at' => now()->toIso8601String(),
                'stale_after_seconds' => 120,
            ],
        ]);
    }


    /** @return Collection<int, LocationUpdate> */
    private function fetchLocations(User $user): Collection
    {
        if (! $user->can(PermissionName::TrackingViewAll->value) && ! $user->can(PermissionName::TrackingShareOwn->value)) {
            return collect();
        }

        return LocationUpdate::query()
            ->visibleTo($user)
            ->with(['user:id,name', 'asset:id,code,name', 'job:id,reference,title'])
            ->latest('captured_at')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, DispatchJob> */
    private function fetchJobs(User $user, bool $canViewAllAssignments): Collection
    {
        if (! Gate::forUser($user)->allows('viewAny', DispatchJob::class)) {
            return collect();
        }

        return DispatchJob::query()
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
            ->get();
    }

    /** @return Collection<int, OperationalAsset> */
    private function fetchAssets(User $user): Collection
    {
        if (! Gate::forUser($user)->allows('viewAny', OperationalAsset::class)) {
            return collect();
        }

        return OperationalAsset::query()
            ->visibleTo($user)
            ->withCount(['maintenanceWorkOrders as blocking_work_orders_count' => fn ($query) => $query->where('dispatch_blocking', true)->whereNull('released_at')])
            ->with([
                'inspections' => fn ($query) => $query->latest('completed_at')->limit(10),
                'maintenanceWorkOrders' => fn ($query) => $query->latest('created_at')->limit(10),
            ])
            ->orderBy('code')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, FuelRequest> */
    private function fetchFuelRequests(User $user): Collection
    {
        if (! Gate::forUser($user)->allows('viewAny', FuelRequest::class)) {
            return collect();
        }

        return FuelRequest::query()
            ->visibleTo($user)
            ->with([
                'requester:id,name',
                'job:id,reference,title',
                'asset:id,code,name',
                'logs.recorder:id,name',
            ])
            ->latest()
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, ApprovalRequest> */
    private function fetchApprovals(User $user): Collection
    {
        $approvalKinds = array_values(array_filter([
            $user->can(PermissionName::AssignmentsApprove->value) ? 'assignment_override' : null,
            $user->can(PermissionName::AssignmentsApprove->value) ? 'reassignment_override' : null,
            $user->can(PermissionName::DispatchApprovePriority->value) ? 'dispatch_activation' : null,
        ]));

        if ($approvalKinds === []) {
            return collect();
        }

        $dispatchMorphClass = (new DispatchJob)->getMorphClass();

        return ApprovalRequest::query()
            ->with([
                'requester:id,name',
                'subject',
            ])
            ->whereIn('kind', $approvalKinds)
            ->where('subject_type', $dispatchMorphClass)
            ->whereIn('subject_id', DispatchJob::query()->visibleTo($user)->select('id'))
            ->where('status', 'pending')
            ->latest()
            ->limit(100)
            ->get()
            ->loadMorph('subject', [
                DispatchJob::class => [
                    'personnelAssignments.user:id,name',
                    'assetAssignments.asset:id,code,name',
                ],
            ]);
    }

    /** @return Collection<int, User> */
    private function fetchUsers(User $user): Collection
    {
        if (! $user->can(PermissionName::UsersManage->value)) {
            return collect();
        }

        return User::query()->with('roles:id,name')->orderBy('name')->limit(100)->get();
    }

    /** @return Collection<int, AuditEvent> */
    private function fetchAuditEvents(User $user): Collection
    {
        if (! $user->can(PermissionName::AuditView->value)) {
            return collect();
        }

        return AuditEvent::query()->with('actor:id,name')->latest('occurred_at')->limit(100)->get();
    }

    /** @return Collection<int, Client> */
    private function fetchClients(bool $canCreateDispatch): Collection
    {
        if (! $canCreateDispatch) {
            return collect();
        }

        return Client::query()->where('status', 'active')->orderBy('company_name')->limit(200)->get();
    }

    /** @return Collection<int, ServiceRequest> */
    private function fetchServiceRequests(bool $canCreateDispatch): Collection
    {
        if (! $canCreateDispatch) {
            return collect();
        }

        return ServiceRequest::query()
            ->with('client:id,code,company_name')
            ->withCount('dispatchJobs')
            ->whereIn('status', ['submitted', 'dispatching'])
            ->orderByRaw('scheduled_date is null')
            ->orderBy('scheduled_date')
            ->latest('created_at')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, GptRecommendation> */
    private function fetchGptRecommendations(User $user): Collection
    {
        if (! Gate::forUser($user)->allows('viewAny', GptRecommendation::class)) {
            return collect();
        }

        $purposes = array_values(array_filter([
            $user->can(PermissionName::GptUseDispatch->value) ? 'dispatch_assignment' : null,
            $user->can(PermissionName::GptUseOperations->value) ? 'operations_review' : null,
            $user->can(PermissionName::GptUseMaintenance->value) ? 'maintenance_advice' : null,
        ]));

        $dispatchMorphClass = (new DispatchJob)->getMorphClass();

        return GptRecommendation::query()
            ->whereIn('purpose', $purposes)
            ->where('subject_type', $dispatchMorphClass)
            ->whereIn('subject_id', DispatchJob::query()->visibleTo($user)->select('id'))
            ->with(['requestedBy:id,name', 'decidedBy:id,name'])
            ->latest()
            ->limit(50)
            ->get();
    }

    /** @return Collection<int, JobReport> */
    private function fetchJobReports(User $user): Collection
    {
        if (! $user->can(PermissionName::ReportsViewAll->value)
            && ! $user->can(PermissionName::ReportsViewDispatch->value)
            && ! $user->can(PermissionName::ReportsViewOwn->value)) {
            return collect();
        }

        return JobReport::query()
            ->visibleTo($user)
            ->with(['job:id,reference,title', 'author:id,name', 'attachments'])
            ->latest('submitted_at')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, Notification> */
    private function fetchNotifications(User $user): Collection
    {
        return Notification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->with(['dispatchJob:id,reference,title'])
            ->latest()
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, DispatchJob> */
    private function fetchArchivedJobs(User $user): Collection
    {
        if (! $user->can(PermissionName::ArchiveManage->value) && ! $user->can(PermissionName::DispatchViewAll->value)) {
            return collect();
        }

        return DispatchJob::onlyTrashed()
            ->visibleTo($user)
            ->with([
                'personnelAssignments.user:id,name',
                'assetAssignments.asset:id,code,name',
            ])
            ->latest('deleted_at')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, ReportExport> */
    private function fetchReportExports(User $user): Collection
    {
        if (! Gate::forUser($user)->allows('viewAny', ReportExport::class)) {
            return collect();
        }

        return ReportExport::query()
            ->visibleTo($user)
            ->latest()
            ->limit(50)
            ->get();
    }
}

