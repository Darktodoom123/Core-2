<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Enums\SalesFulfillmentMode;
use App\Modules\Sales\Models\SalesOrder;
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
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

final class OperationsWorkspaceController extends Controller
{
    private const int WORKSPACE_STALE_AFTER_SECONDS = 120;

    /** @var array<string, list<string>> */
    private const SECTION_PROPS = [
        'overview' => ['jobs', 'clients', 'serviceRequests', 'assets', 'assets_total', 'fuelRequests', 'locations', 'approvals', 'users', 'auditEvents', 'gptRecommendations'],
        'dispatch' => ['jobs', 'clients', 'serviceRequests', 'rentalHandoffs', 'salesHandoffs', 'assets', 'assets_total', 'approvals', 'users', 'gptRecommendations'],
        'assets' => ['assets', 'assets_total', 'locations'],
        'tracking' => ['assets', 'assets_total', 'locations'],
        'fuel' => ['fuelRequests', 'assets', 'assets_total'],
        'approvals' => ['approvals'],
        'reports' => ['jobReports', 'reportExports', 'jobs'],
        'notifications' => ['notifications'],
        'archive' => ['archivedJobs'],
        'gpt-recommendations' => ['gptRecommendations', 'jobs'],
        'users' => ['users', 'auditEvents'],
        'audit' => ['auditEvents'],
        'sos' => [],
        'safety' => [],
    ];

    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $canCreateDispatch = $user->can(PermissionName::DispatchCreate->value);
        $canViewRentalHandoffs = $canCreateDispatch && $user->can(PermissionName::RentalView->value);
        $canViewSalesHandoffs = $canCreateDispatch && $user->can(PermissionName::SalesView->value);
        $canViewAllAssignments = $user->can(PermissionName::AssignmentsViewAll->value);
        $refreshedAt = now();
        $navigation = OperationsWorkspaceViewModel::navigation($user);
        $activeSos = $this->fetchActiveSosIncidents($user);
        $initialSection = $this->initialSection($request, $navigation, $user, $activeSos);
        $sectionCache = null;
        $loadSection = function () use (&$sectionCache, $initialSection, $user, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs, $canViewAllAssignments): array {
            request()->attributes->set('workspace_inertia_mode', 'deferred');

            return $sectionCache ??= $this->loadSection(
                $initialSection,
                $user,
                $canCreateDispatch,
                $canViewRentalHandoffs,
                $canViewSalesHandoffs,
                $canViewAllAssignments,
            );
        };

        $props = [
            'navigation' => $navigation,
            'initial_section' => $initialSection,
            'capabilities' => OperationsWorkspaceViewModel::capabilities($user),
            'badges' => $this->fetchBadges($user, count($activeSos)),
            'workspace' => [
                'refreshed_at' => $refreshedAt->toIso8601String(),
                'stale_after_seconds' => self::WORKSPACE_STALE_AFTER_SECONDS,
                'tracking' => $this->trackingFreshness($user, $refreshedAt),
            ],
            // SOS is intentionally eager. Responders must see a current
            // emergency regardless of the selected deferred workspace section.
            'activeSosIncidents' => $activeSos,
        ];

        foreach ($this->allSectionProps() as $prop) {
            $resolver = fn (): mixed => $this->resolveSectionProp($prop, $loadSection, $user, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs, $canViewAllAssignments);
            $props[$prop] = in_array($prop, self::SECTION_PROPS[$initialSection] ?? [], true)
                ? Inertia::defer($resolver, 'workspace-'.($initialSection ?? 'none'))
                : Inertia::optional($resolver);
        }

        return Inertia::render('workspace', $props);
    }

    /** @return list<string> */
    private function allSectionProps(): array
    {
        return array_values(array_unique(array_merge(...array_values(self::SECTION_PROPS))));
    }

    /** @return array<string, mixed> */
    private function loadSection(
        ?string $section,
        User $user,
        bool $canCreateDispatch,
        bool $canViewRentalHandoffs,
        bool $canViewSalesHandoffs,
        bool $canViewAllAssignments,
    ): array {
        [$overviewAssets, $overviewAssetsTotal] = $this->fetchAssetsWithTotal($user, 50);
        [$defaultAssets, $defaultAssetsTotal] = $this->fetchAssetsWithTotal($user);

        return match ($section) {
            'overview' => [
                'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments, 6)),
                'clients' => OperationsWorkspaceViewModel::clients($this->fetchClients($canCreateDispatch)),
                'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($this->fetchServiceRequests($canCreateDispatch)),
                'assets' => OperationsWorkspaceViewModel::assets($overviewAssets),
                'assets_total' => $overviewAssetsTotal,
                'fuelRequests' => OperationsWorkspaceViewModel::fuelRequests($this->fetchFuelRequests($user)),
                'locations' => OperationsWorkspaceViewModel::locations($this->fetchLocations($user)),
                'approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user),
                'users' => OperationsWorkspaceViewModel::users($this->fetchUsers($user, 50)),
                'auditEvents' => OperationsWorkspaceViewModel::auditEvents($this->fetchAuditEvents($user)),
                'gptRecommendations' => OperationsWorkspaceViewModel::gptRecommendations($this->fetchGptRecommendations($user)),
            ],
            'dispatch' => [
                'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
                'clients' => OperationsWorkspaceViewModel::clients($this->fetchClients($canCreateDispatch)),
                'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($this->fetchServiceRequests($canCreateDispatch)),
                'rentalHandoffs' => OperationsWorkspaceViewModel::rentalHandoffs($this->fetchRentalHandoffs($canViewRentalHandoffs)),
                'salesHandoffs' => OperationsWorkspaceViewModel::salesHandoffs($this->fetchSalesHandoffs($canViewSalesHandoffs)),
                'assets' => OperationsWorkspaceViewModel::assets($defaultAssets),
                'assets_total' => $defaultAssetsTotal,
                'approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user),
                'users' => OperationsWorkspaceViewModel::users($this->fetchUsers($user)),
                'gptRecommendations' => OperationsWorkspaceViewModel::gptRecommendations($this->fetchGptRecommendations($user)),
            ],
            'assets', 'tracking' => [
                'assets' => OperationsWorkspaceViewModel::assets($defaultAssets),
                'assets_total' => $defaultAssetsTotal,
                'locations' => OperationsWorkspaceViewModel::locations($this->fetchLocations($user)),
            ],
            'fuel' => [
                'fuelRequests' => OperationsWorkspaceViewModel::fuelRequests($this->fetchFuelRequests($user)),
                'assets' => OperationsWorkspaceViewModel::assets($defaultAssets),
                'assets_total' => $defaultAssetsTotal,
            ],
            'approvals' => ['approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user)],
            'reports' => [
                'jobReports' => OperationsWorkspaceViewModel::jobReports($this->fetchJobReports($user)),
                'reportExports' => OperationsWorkspaceViewModel::reportExports($this->fetchReportExports($user)),
                'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
            ],
            'notifications' => ['notifications' => OperationsWorkspaceViewModel::notifications($this->fetchNotifications($user))],
            'archive' => ['archivedJobs' => OperationsWorkspaceViewModel::archivedJobs($this->fetchArchivedJobs($user))],
            'gpt-recommendations' => [
                'gptRecommendations' => OperationsWorkspaceViewModel::gptRecommendations($this->fetchGptRecommendations($user)),
                'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
            ],
            'users' => [
                'users' => OperationsWorkspaceViewModel::users($this->fetchUsers($user)),
                'auditEvents' => OperationsWorkspaceViewModel::auditEvents($this->fetchAuditEvents($user)),
            ],
            'audit' => ['auditEvents' => OperationsWorkspaceViewModel::auditEvents($this->fetchAuditEvents($user))],
            'sos' => [],
            default => [],
        };
    }

    private function resolveSectionProp(string $prop, callable $loadSection, User $user, bool $canCreateDispatch, bool $canViewRentalHandoffs, bool $canViewSalesHandoffs, bool $canViewAllAssignments): mixed
    {
        $data = $loadSection();
        if (array_key_exists($prop, $data)) {
            return $data[$prop];
        }

        return $this->standaloneProp($prop, $user, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs, $canViewAllAssignments);
    }

    private function standaloneProp(string $prop, User $user, bool $canCreateDispatch, bool $canViewRentalHandoffs, bool $canViewSalesHandoffs, bool $canViewAllAssignments): mixed
    {
        return match ($prop) {
            'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
            'clients' => OperationsWorkspaceViewModel::clients($this->fetchClients($canCreateDispatch)),
            'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($this->fetchServiceRequests($canCreateDispatch)),
            'rentalHandoffs' => OperationsWorkspaceViewModel::rentalHandoffs($this->fetchRentalHandoffs($canViewRentalHandoffs)),
            'salesHandoffs' => OperationsWorkspaceViewModel::salesHandoffs($this->fetchSalesHandoffs($canViewSalesHandoffs)),
            'assets' => OperationsWorkspaceViewModel::assets($this->fetchAssets($user)),
            'assets_total' => $this->fetchAssetsTotal($user),
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
            default => [],
        };
    }

    /**
     * @param  array<int, array{id: string, label: string}>  $navigation
     * @param  array<int, mixed>  $activeSos
     */
    private function initialSection(Request $request, array $navigation, User $user, array $activeSos): ?string
    {
        $requested = $request->query('view') ?? $request->query('section');

        if ($requested === 'exports') {
            $requested = 'reports';
        }

        if ($requested === 'sos' && ($user->can('sos.view') || $user->can('sos.respond') || count($activeSos) > 0)) {
            return 'sos';
        }

        if (is_string($requested) && collect($navigation)->contains('id', $requested)) {
            return $requested;
        }

        return $navigation[0]['id'] ?? null;
    }

    /** @return array<string, mixed> */
    private function trackingFreshness(User $user, CarbonImmutable $refreshedAt): array
    {
        $canViewTracking = $user->can(PermissionName::TrackingViewAll->value)
            || $user->can(PermissionName::TrackingShareOwn->value);

        if (! $canViewTracking) {
            return [
                'refreshed_at' => $refreshedAt->toIso8601String(),
                'stale_after_seconds' => self::WORKSPACE_STALE_AFTER_SECONDS,
                'latest_received_at' => null,
                'current_user' => null,
            ];
        }

        $latestVisibleLocation = LocationUpdate::query()
            ->visibleTo($user)
            ->latest('received_at')
            ->latest('id')
            ->first(['received_at']);
        $latestOwnLocation = LocationUpdate::query()
            ->where('user_id', $user->id)
            ->latest('received_at')
            ->latest('id')
            ->first(['sharing_enabled', 'captured_at', 'received_at']);

        return [
            'refreshed_at' => $refreshedAt->toIso8601String(),
            'stale_after_seconds' => self::WORKSPACE_STALE_AFTER_SECONDS,
            'latest_received_at' => $latestVisibleLocation?->received_at?->toIso8601String(),
            'current_user' => [
                'sharing_enabled' => $latestOwnLocation?->sharing_enabled,
                'captured_at' => $latestOwnLocation?->captured_at?->toIso8601String(),
                'received_at' => $latestOwnLocation?->received_at?->toIso8601String(),
            ],
        ];
    }

    /** @return Collection<int, LocationUpdate> */
    private function fetchLocations(User $user): Collection
    {
        if (! $user->can(PermissionName::TrackingViewAll->value) && ! $user->can(PermissionName::TrackingShareOwn->value)) {
            return collect();
        }

        $latestLocationIds = LocationUpdate::query()
            ->visibleTo($user)
            ->selectRaw('MAX(id)')
            ->groupBy('user_id', 'operational_asset_id');

        return LocationUpdate::query()
            ->visibleTo($user)
            ->whereIn('id', $latestLocationIds)
            ->with(['user:id,name', 'asset:id,code,name,kind', 'job:id,reference,title'])
            ->latest('received_at')
            ->latest('id')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, DispatchJob> */
    private function fetchJobs(User $user, bool $canViewAllAssignments, int $limit = 100): Collection
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
                'source',
                'serviceRequest:id,reference',
                'canonicalHandoff',
            ])
            ->orderBy('scheduled_start')
            ->limit($limit)
            ->get()
            ->sortBy(fn (DispatchJob $job): int => in_array($job->status->value, ['working', 'arrived', 'en_route', 'accepted', 'dispatched'], true) ? 0 : 1)
            ->values();
    }

    /** @return array{0: Collection<int, OperationalAsset>, 1: int} */
    private function fetchAssetsWithTotal(User $user, int $limit = 100): array
    {
        if (! Gate::forUser($user)->allows('viewAny', OperationalAsset::class)) {
            return [collect(), 0];
        }

        $query = OperationalAsset::query()->visibleTo($user);
        $total = (clone $query)->toBase()->count();

        $assets = $query
            ->withCount(['maintenanceWorkOrders as blocking_work_orders_count' => fn ($query) => $query->where('dispatch_blocking', true)->whereNull('released_at')])
            ->with([
                'inspections' => fn ($query) => $query->latest('completed_at')->limit(10),
                'maintenanceWorkOrders' => fn ($query) => $query->latest('created_at')->limit(10),
            ])
            ->orderBy('code')
            ->limit($limit)
            ->get();

        return [$assets, $total];
    }

    /** @return Collection<int, OperationalAsset> */
    private function fetchAssets(User $user, int $limit = 100): Collection
    {
        return $this->fetchAssetsWithTotal($user, $limit)[0];
    }

    private function fetchAssetsTotal(User $user): int
    {
        if (! Gate::forUser($user)->allows('viewAny', OperationalAsset::class)) {
            return 0;
        }

        return OperationalAsset::query()->visibleTo($user)->toBase()->count();
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
                'asset:id,code,name,kind,subtype,registration_number,manufacturer,model,meter_type,meter_value,baseline_burn_rate,burn_rate_unit',
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
    private function fetchUsers(User $user, int $limit = 200): Collection
    {
        if (
            ! $user->can(PermissionName::UsersManage->value) &&
            ! $user->can(PermissionName::AssignmentsViewAll->value) &&
            ! $user->can(PermissionName::DispatchViewAll->value)
        ) {
            return collect();
        }

        return User::query()
            ->with(['roles:id,name', 'personnelProfile', 'personnelCredentials'])
            ->orderBy('name')
            ->limit($limit)
            ->get();
    }

    /** @return array{jobs: int, pending_approvals: int, unread_notifications: int, blocking_assets: int, pending_fuel: int, active_sos: int} */
    private function fetchBadges(User $user, int $activeSosCount = 0): array
    {
        $jobs = Gate::forUser($user)->allows('viewAny', DispatchJob::class)
            ? DispatchJob::query()->visibleTo($user)->count()
            : 0;
        $approvalKinds = array_values(array_filter([
            $user->can(PermissionName::AssignmentsApprove->value) ? 'assignment_override' : null,
            $user->can(PermissionName::AssignmentsApprove->value) ? 'reassignment_override' : null,
            $user->can(PermissionName::DispatchApprovePriority->value) ? 'dispatch_activation' : null,
        ]));
        $pendingApprovals = $approvalKinds === []
            ? 0
            : ApprovalRequest::query()
                ->whereIn('kind', $approvalKinds)
                ->where('status', 'pending')
                ->where('subject_type', (new DispatchJob)->getMorphClass())
                ->whereIn('subject_id', DispatchJob::query()->visibleTo($user)->select('id'))
                ->count();
        $unreadNotifications = Notification::query()
            ->where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->id)
            ->where(function ($query): void {
                $query->where('status', '!=', 'read')->orWhereNull('read_at');
            })
            ->count();
        $blockingAssets = Gate::forUser($user)->allows('viewAny', OperationalAsset::class)
            ? OperationalAsset::query()
                ->visibleTo($user)
                ->whereHas('maintenanceWorkOrders', fn ($query) => $query->where('dispatch_blocking', true)->whereNull('released_at'))
                ->count()
            : 0;
        $pendingFuel = Gate::forUser($user)->allows('viewAny', FuelRequest::class)
            ? FuelRequest::query()->whereIn('status', ['forwarded', 'submitted'])->count()
            : 0;

        return [
            'jobs' => $jobs,
            'pending_approvals' => $pendingApprovals,
            'unread_notifications' => $unreadNotifications,
            'blocking_assets' => $blockingAssets,
            'pending_fuel' => $pendingFuel,
            'active_sos' => $activeSosCount,
        ];
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

    /** @return Collection<int, RentalReservation> */
    private function fetchRentalHandoffs(bool $canView): Collection
    {
        if (! $canView) {
            return collect();
        }

        return RentalReservation::query()
            ->with('client:id,code,company_name')
            ->where('status', 'reserved')
            ->where('fulfillment_mode', RentalFulfillmentMode::Delivery->value)
            ->whereNull('dispatch_job_id')
            ->orderBy('start_date')
            ->latest('id')
            ->limit(100)
            ->get();
    }

    /** @return Collection<int, SalesOrder> */
    private function fetchSalesHandoffs(bool $canView): Collection
    {
        if (! $canView) {
            return collect();
        }

        return SalesOrder::query()
            ->with('client:id,code,company_name')
            ->where('status', 'confirmed')
            ->where('fulfillment_mode', SalesFulfillmentMode::Delivery->value)
            ->whereNull('dispatch_job_id')
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

    /** @return array<int, array<string, mixed>> */
    private function fetchActiveSosIncidents(User $user): array
    {
        if (! $user->can('sos.view')) {
            return [];
        }

        $modelClass = 'App\\Platform\\Safety\\Models\\SosIncident';

        // The workspace can be deployed ahead of the safety migration. Keep
        // the prop safely empty until that server boundary is available.
        if (! class_exists($modelClass)) {
            return [];
        }

        if (! Schema::hasTable('sos_incidents')) {
            return [];
        }

        /** @var Collection<int, Model> $incidents */
        $incidents = $modelClass::query()
            ->whereIn('status', ['active', 'escalated', 'acknowledged'])
            ->with([
                'reporter:id,name,phone',
                'dispatchJob:id,reference,title,site',
                'operationalAsset:id,code,name',
                'acknowledgedBy:id,name,phone',
                'resolvedBy:id,name,phone',
                'deliveryAttempts',
            ])
            ->latest('received_at')
            ->limit(100)
            ->get();

        return OperationsWorkspaceViewModel::activeSosIncidents(
            $incidents,
            $user->can('sos.respond'),
        );
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
