<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Dispatch\Planning\Queries\ProjectPlanningQuery;
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
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Workspace\Queries\WorkspaceAssetsQuery;
use App\Platform\Workspace\Queries\WorkspaceFuelRequestsQuery;
use App\Platform\Workspace\Queries\WorkspaceJobReportsQuery;
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

    public function __construct(
        private readonly TrackingClientInterface $trackingClient,
    ) {}

    /** @var array<string, list<string>> */
    private const SECTION_PROPS = [
        'overview' => ['jobs', 'clients', 'serviceRequests', 'assets', 'assets_total', 'fuelRequests', 'locations', 'approvals', 'users', 'auditEvents', 'gptRecommendations'],
        'dispatch' => ['jobs', 'clients', 'serviceRequests', 'rentalHandoffs', 'salesHandoffs', 'assets', 'assets_total', 'approvals', 'dispatchResourceUsers', 'gptRecommendations', 'projectPlanning'],
        'assets' => ['assets', 'assets_total', 'assets_pagination', 'locations'],
        'tracking' => ['assets', 'assets_total', 'locations'],
        'fuel' => ['fuelRequests', 'fuelRequests_total', 'fuelRequests_stats', 'fuelRequests_pagination', 'assets', 'assets_total'],
        'approvals' => ['approvals'],
        'reports' => ['jobReports', 'jobReports_total', 'jobReports_stats', 'jobReports_pagination', 'reportExports', 'jobs'],
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

        /** @var array{search?: string|null, category?: string|null, page?: int|null, per_page?: int|null} $assetFilters */
        $assetFilters = [
            'search' => $request->query('asset_search') ?? ($initialSection === 'assets' ? ($request->query('search') ?? $request->query('q')) : null),
            'category' => $request->query('asset_category') ?? ($initialSection === 'assets' ? $request->query('category') : null),
            'page' => $request->integer('asset_page') ?: ($initialSection === 'assets' ? $request->integer('page', 1) : 1),
            'per_page' => $request->integer('asset_per_page') ?: 50,
        ];

        /** @var array{search?: string|null, status?: string|null, page?: int|null, per_page?: int|null} $fuelFilters */
        $fuelFilters = [
            'search' => $request->query('fuel_search') ?? ($initialSection === 'fuel' ? ($request->query('search') ?? $request->query('q')) : null),
            'status' => $request->query('fuel_status') ?? ($initialSection === 'fuel' ? $request->query('status') : null),
            'page' => $request->integer('fuel_page') ?: ($initialSection === 'fuel' ? $request->integer('page', 1) : 1),
            'per_page' => $request->integer('fuel_per_page') ?: 25,
        ];

        /** @var array{search?: string|null, status?: string|null, job_id?: int|null, page?: int|null, per_page?: int|null} $reportFilters */
        $reportFilters = [
            'search' => $request->query('report_search') ?? ($initialSection === 'reports' ? ($request->query('search') ?? $request->query('q')) : null),
            'status' => $request->query('report_status') ?? ($initialSection === 'reports' ? $request->query('status') : null),
            'job_id' => $request->integer('job_id') ?: ($request->integer('dispatch_id') ?: null),
            'page' => $request->integer('report_page') ?: ($initialSection === 'reports' ? $request->integer('page', 1) : 1),
            'per_page' => $request->integer('report_per_page') ?: 25,
        ];

        $sectionCache = null;
        $loadSection = function () use (&$sectionCache, $initialSection, $user, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs, $canViewAllAssignments, $assetFilters, $fuelFilters, $reportFilters): array {
            request()->attributes->set('workspace_inertia_mode', 'deferred');

            return $sectionCache ??= $this->loadSection(
                $initialSection,
                $user,
                $canCreateDispatch,
                $canViewRentalHandoffs,
                $canViewSalesHandoffs,
                $canViewAllAssignments,
                $assetFilters,
                $fuelFilters,
                $reportFilters,
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

        $hasErrors = $request->session()->has('errors');

        foreach ($this->allSectionProps() as $prop) {
            $resolver = fn (): mixed => $this->resolveSectionProp($prop, $loadSection, $user, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs, $canViewAllAssignments, $assetFilters, $fuelFilters, $reportFilters);
            $props[$prop] = in_array($prop, self::SECTION_PROPS[$initialSection] ?? [], true)
                ? ($hasErrors ? $resolver() : Inertia::defer($resolver, 'workspace-'.($initialSection ?? 'none')))
                : Inertia::optional($resolver);
        }

        $props['projectPlanning'] = in_array('projectPlanning', self::SECTION_PROPS[$initialSection] ?? [], true)
            ? ($hasErrors ? app(ProjectPlanningQuery::class)->make($user) : Inertia::defer(fn () => app(ProjectPlanningQuery::class)->make($user), 'workspace-'.($initialSection ?? 'none')))
            : Inertia::optional(fn () => app(ProjectPlanningQuery::class)->make($user));

        return Inertia::render('workspace', $props);
    }

    /** @return list<string> */
    private function allSectionProps(): array
    {
        return array_values(array_unique(array_merge(...array_values(self::SECTION_PROPS))));
    }

    /**
     * @param  array{search?: string|null, category?: string|null, page?: int|null, per_page?: int|null}  $assetFilters
     * @param  array{search?: string|null, status?: string|null, page?: int|null, per_page?: int|null}  $fuelFilters
     * @param  array{search?: string|null, status?: string|null, job_id?: int|null, page?: int|null, per_page?: int|null}  $reportFilters
     * @return array<string, mixed>
     */
    private function loadSection(
        ?string $section,
        User $user,
        bool $canCreateDispatch,
        bool $canViewRentalHandoffs,
        bool $canViewSalesHandoffs,
        bool $canViewAllAssignments,
        array $assetFilters = [],
        array $fuelFilters = [],
        array $reportFilters = [],
    ): array {
        return match ($section) {
            'overview' => (function () use ($user, $canViewAllAssignments, $canCreateDispatch): array {
                [$overviewAssets, $overviewAssetsTotal] = $this->fetchAssetsWithTotal($user, 50);

                return [
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
                ];
            })(),
            'dispatch' => (function () use ($user, $canViewAllAssignments, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs): array {
                [$defaultAssets, $defaultAssetsTotal] = $this->fetchAssetsWithTotal($user);

                return [
                    'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
                    'clients' => OperationsWorkspaceViewModel::clients($this->fetchClients($canCreateDispatch)),
                    'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($this->fetchServiceRequests($canCreateDispatch)),
                    'rentalHandoffs' => OperationsWorkspaceViewModel::rentalHandoffs($this->fetchRentalHandoffs($canViewRentalHandoffs)),
                    'salesHandoffs' => OperationsWorkspaceViewModel::salesHandoffs($this->fetchSalesHandoffs($canViewSalesHandoffs)),
                    'assets' => OperationsWorkspaceViewModel::assets($defaultAssets),
                    'assets_total' => $defaultAssetsTotal,
                    'approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user),
                    'dispatchResourceUsers' => OperationsWorkspaceViewModel::dispatchResourceUsers($this->fetchDispatchResourceUsers($user)),
                    'gptRecommendations' => OperationsWorkspaceViewModel::gptRecommendations($this->fetchGptRecommendations($user)),
                ];
            })(),
            'assets' => (function () use ($user, $assetFilters): array {
                $assetPaginator = app(WorkspaceAssetsQuery::class)->paginate($user, $assetFilters);

                return [
                    'assets' => OperationsWorkspaceViewModel::assets($assetPaginator->getCollection()),
                    'assets_total' => $assetPaginator->total(),
                    'assets_pagination' => [
                        'current_page' => $assetPaginator->currentPage(),
                        'last_page' => $assetPaginator->lastPage(),
                        'per_page' => $assetPaginator->perPage(),
                        'total' => $assetPaginator->total(),
                    ],
                    'locations' => OperationsWorkspaceViewModel::locations($this->fetchLocations($user)),
                ];
            })(),
            'tracking' => (function () use ($user): array {
                [$defaultAssets, $defaultAssetsTotal] = $this->fetchAssetsWithTotal($user);

                return [
                    'assets' => OperationsWorkspaceViewModel::assets($defaultAssets),
                    'assets_total' => $defaultAssetsTotal,
                    'locations' => OperationsWorkspaceViewModel::locations($this->fetchLocations($user)),
                ];
            })(),
            'fuel' => (function () use ($user, $fuelFilters): array {
                $fuelPaginator = app(WorkspaceFuelRequestsQuery::class)->paginate($user, $fuelFilters);
                [$defaultAssets, $defaultAssetsTotal] = $this->fetchAssetsWithTotal($user);

                return [
                    'fuelRequests' => OperationsWorkspaceViewModel::fuelRequests($fuelPaginator->getCollection()),
                    'fuelRequests_total' => $fuelPaginator->total(),
                    'fuelRequests_stats' => app(WorkspaceFuelRequestsQuery::class)->counts($user),
                    'fuelRequests_pagination' => [
                        'current_page' => $fuelPaginator->currentPage(),
                        'last_page' => $fuelPaginator->lastPage(),
                        'per_page' => $fuelPaginator->perPage(),
                        'total' => $fuelPaginator->total(),
                    ],
                    'assets' => OperationsWorkspaceViewModel::assets($defaultAssets),
                    'assets_total' => $defaultAssetsTotal,
                ];
            })(),
            'approvals' => ['approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user)],
            'reports' => (function () use ($user, $reportFilters, $canViewAllAssignments): array {
                $reportPaginator = app(WorkspaceJobReportsQuery::class)->paginate($user, $reportFilters);

                return [
                    'jobReports' => OperationsWorkspaceViewModel::jobReports($reportPaginator->getCollection()),
                    'jobReports_total' => $reportPaginator->total(),
                    'jobReports_stats' => app(WorkspaceJobReportsQuery::class)->stats($user, $reportFilters),
                    'jobReports_pagination' => [
                        'current_page' => $reportPaginator->currentPage(),
                        'last_page' => $reportPaginator->lastPage(),
                        'per_page' => $reportPaginator->perPage(),
                        'total' => $reportPaginator->total(),
                    ],
                    'reportExports' => OperationsWorkspaceViewModel::reportExports($this->fetchReportExports($user)),
                    'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
                ];
            })(),
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

    /**
     * @param  array{search?: string|null, category?: string|null, page?: int|null, per_page?: int|null}  $assetFilters
     * @param  array{search?: string|null, status?: string|null, page?: int|null, per_page?: int|null}  $fuelFilters
     * @param  array{search?: string|null, status?: string|null, job_id?: int|null, page?: int|null, per_page?: int|null}  $reportFilters
     */
    private function resolveSectionProp(
        string $prop,
        callable $loadSection,
        User $user,
        bool $canCreateDispatch,
        bool $canViewRentalHandoffs,
        bool $canViewSalesHandoffs,
        bool $canViewAllAssignments,
        array $assetFilters = [],
        array $fuelFilters = [],
        array $reportFilters = [],
    ): mixed {
        $data = $loadSection();
        if (array_key_exists($prop, $data)) {
            return $data[$prop];
        }

        return $this->standaloneProp($prop, $user, $canCreateDispatch, $canViewRentalHandoffs, $canViewSalesHandoffs, $canViewAllAssignments, $assetFilters, $fuelFilters, $reportFilters);
    }

    /**
     * @param  array{search?: string|null, category?: string|null, page?: int|null, per_page?: int|null}  $assetFilters
     * @param  array{search?: string|null, status?: string|null, page?: int|null, per_page?: int|null}  $fuelFilters
     * @param  array{search?: string|null, status?: string|null, job_id?: int|null, page?: int|null, per_page?: int|null}  $reportFilters
     */
    private function standaloneProp(
        string $prop,
        User $user,
        bool $canCreateDispatch,
        bool $canViewRentalHandoffs,
        bool $canViewSalesHandoffs,
        bool $canViewAllAssignments,
        array $assetFilters = [],
        array $fuelFilters = [],
        array $reportFilters = [],
    ): mixed {
        return match ($prop) {
            'jobs' => OperationsWorkspaceViewModel::jobs($this->fetchJobs($user, $canViewAllAssignments)),
            'clients' => OperationsWorkspaceViewModel::clients($this->fetchClients($canCreateDispatch)),
            'serviceRequests' => OperationsWorkspaceViewModel::serviceRequests($this->fetchServiceRequests($canCreateDispatch)),
            'rentalHandoffs' => OperationsWorkspaceViewModel::rentalHandoffs($this->fetchRentalHandoffs($canViewRentalHandoffs)),
            'salesHandoffs' => OperationsWorkspaceViewModel::salesHandoffs($this->fetchSalesHandoffs($canViewSalesHandoffs)),
            'assets' => OperationsWorkspaceViewModel::assets($this->fetchAssets($user)),
            'assets_total' => $this->fetchAssetsTotal($user),
            'assets_pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 50,
                'total' => $this->fetchAssetsTotal($user),
            ],
            'fuelRequests' => OperationsWorkspaceViewModel::fuelRequests($this->fetchFuelRequests($user)),
            'fuelRequests_total' => app(WorkspaceFuelRequestsQuery::class)->counts($user)['total'],
            'fuelRequests_stats' => app(WorkspaceFuelRequestsQuery::class)->counts($user),
            'fuelRequests_pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 25,
                'total' => app(WorkspaceFuelRequestsQuery::class)->counts($user)['total'],
            ],
            'locations' => OperationsWorkspaceViewModel::locations($this->fetchLocations($user)),
            'approvals' => OperationsWorkspaceViewModel::approvals($this->fetchApprovals($user), $user),
            'dispatchResourceUsers' => OperationsWorkspaceViewModel::dispatchResourceUsers($this->fetchDispatchResourceUsers($user)),
            'users' => OperationsWorkspaceViewModel::users($this->fetchUsers($user)),
            'auditEvents' => OperationsWorkspaceViewModel::auditEvents($this->fetchAuditEvents($user)),
            'gptRecommendations' => OperationsWorkspaceViewModel::gptRecommendations($this->fetchGptRecommendations($user)),
            'jobReports' => OperationsWorkspaceViewModel::jobReports($this->fetchJobReports($user)),
            'jobReports_total' => app(WorkspaceJobReportsQuery::class)->stats($user, $reportFilters)['total'],
            'jobReports_stats' => app(WorkspaceJobReportsQuery::class)->stats($user, $reportFilters),
            'jobReports_pagination' => [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 25,
                'total' => app(WorkspaceJobReportsQuery::class)->stats($user, $reportFilters)['total'],
            ],
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
        return $this->trackingClient->getTrackingFreshness($user, $refreshedAt, self::WORKSPACE_STALE_AFTER_SECONDS);
    }

    /** @return Collection<int, LatestLocationDto> */
    private function fetchLocations(User $user): Collection
    {
        if (! $user->can(PermissionName::TrackingViewAll->value) && ! $user->can(PermissionName::TrackingShareOwn->value)) {
            return collect();
        }

        /** @var Collection<int, LatestLocationDto> $telemetryLocations */
        $telemetryLocations = $this->trackingClient->getLatestLocations($user);

        $telemetryAssetIds = $telemetryLocations
            ->pluck('operationalAssetId')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $authorizedAssetsQuery = OperationalAsset::query()->visibleTo($user);
        if (! empty($telemetryAssetIds)) {
            $authorizedAssetsQuery->orWhereIn('id', $telemetryAssetIds);
        }

        /** @var Collection<int, OperationalAsset> $authorizedAssets */
        $authorizedAssets = $authorizedAssetsQuery
            ->get(['id', 'code', 'name', 'kind', 'status', 'location'])
            ->keyBy('id');

        if ($authorizedAssets->isEmpty()) {
            return collect();
        }

        $assetIds = $authorizedAssets->keys()->map(fn ($id) => (int) $id)->all();

        /** @var Collection<int, DispatchAssetAssignment> $activeAssignments */
        $activeAssignments = DispatchAssetAssignment::query()
            ->active()
            ->whereIn('operational_asset_id', $assetIds)
            ->with([
                'job:id,reference,title,site',
                'job.personnelAssignments' => fn ($q) => $q->active()->with('user:id,name'),
            ])
            ->get()
            ->keyBy('operational_asset_id');

        // Deduplicate to show exactly one current telemetry record per asset, keeping the newest valid report.
        $latestByAsset = $telemetryLocations
            ->filter(static fn (LatestLocationDto $dto): bool => $dto->operationalAssetId !== null && $authorizedAssets->has($dto->operationalAssetId))
            ->groupBy('operationalAssetId')
            ->map(static function (Collection $assetLocations): LatestLocationDto {
                return $assetLocations
                    ->sortByDesc(static function (LatestLocationDto $dto): string {
                        $time = $dto->capturedAt ?? $dto->receivedAt;
                        $iso = $time ? $time->toIso8601String() : '';

                        return sprintf('%s_%010d', $iso, $dto->id);
                    })
                    ->first();
            });

        $telemetryUserIds = $latestByAsset->pluck('userId')->unique()->values()->all();
        $telemetryUsers = User::query()
            ->whereIn('id', $telemetryUserIds)
            ->get(['id', 'name'])
            ->keyBy('id');

        $telemetryJobIds = $latestByAsset->pluck('dispatchJobId')->filter()->unique()->values()->all();
        $telemetryJobs = ! empty($telemetryJobIds)
            ? DispatchJob::query()
                ->whereIn('id', $telemetryJobIds)
                ->get(['id', 'reference', 'title', 'site', 'status'])
                ->keyBy('id')
            : collect();

        return $authorizedAssets->map(static function (OperationalAsset $asset) use ($activeAssignments, $latestByAsset, $telemetryUsers, $telemetryJobs): LatestLocationDto {
            $assignment = $activeAssignments->get($asset->id);
            $latestDto = $latestByAsset->get($asset->id);

            $jobModel = $assignment !== null ? $assignment->job : null;
            if ($jobModel === null && $latestDto?->dispatchJobId !== null) {
                $jobModel = $telemetryJobs->get($latestDto->dispatchJobId);
            }

            $isAssigned = false;
            if ($assignment !== null) {
                $isAssigned = true;
            } elseif ($jobModel instanceof DispatchJob && ! in_array($jobModel->status, [DispatchStatus::Completed, DispatchStatus::Cancelled], true)) {
                $hasEndedAssignment = DispatchAssetAssignment::query()
                    ->where('operational_asset_id', $asset->id)
                    ->where('dispatch_job_id', $jobModel->id)
                    ->whereNotNull('active_until')
                    ->where('active_until', '<=', now())
                    ->exists();

                $isAssigned = ! $hasEndedAssignment;
            }

            $assignmentStatus = $isAssigned ? 'assigned' : 'unassigned';

            $activeOperator = $assignment?->job?->personnelAssignments?->first()?->user;

            $assetPayload = [
                'id' => (int) $asset->id,
                'code' => $asset->code,
                'name' => $asset->name,
                'kind' => $asset->kind,
                'status' => $asset->status->value,
                'status_label' => $asset->status->label(),
                'location' => $asset->location,
            ];

            $jobPayload = $isAssigned && $jobModel !== null ? [
                'id' => (int) $jobModel->id,
                'reference' => $jobModel->reference,
                'title' => $jobModel->title,
                'site' => $jobModel->site,
            ] : null;

            if ($latestDto !== null) {
                $telemetryUser = $telemetryUsers->get($latestDto->userId);
                $telemetryUserName = $telemetryUser instanceof User
                    ? $telemetryUser->name
                    : ($latestDto->userId > 0 ? 'Unassigned operator' : 'Unassigned');

                $userPayload = [
                    'id' => $activeOperator !== null ? (int) $activeOperator->id : (int) $latestDto->userId,
                    'name' => $activeOperator !== null ? $activeOperator->name : $telemetryUserName,
                ];

                $hasGps = $latestDto->latitude !== null && $latestDto->longitude !== null;

                return $latestDto->withHydratedEntities(
                    user: $userPayload,
                    asset: $assetPayload,
                    job: $jobPayload,
                    isAssigned: $isAssigned,
                    assignmentStatus: $assignmentStatus,
                    recordedLocation: $asset->location,
                    hasGpsReport: $hasGps,
                );
            }

            $userPayload = $isAssigned && $activeOperator !== null
                ? ['id' => (int) $activeOperator->id, 'name' => $activeOperator->name]
                : ['id' => 0, 'name' => 'Unassigned'];

            return new LatestLocationDto(
                id: -((int) $asset->id),
                userId: $userPayload['id'],
                operationalAssetId: (int) $asset->id,
                dispatchJobId: $jobPayload['id'] ?? null,
                latitude: null,
                longitude: null,
                accuracyMetres: null,
                speed: null,
                remarks: null,
                source: 'recorded',
                sharingEnabled: true,
                capturedAt: null,
                receivedAt: null,
                freshnessStatus: 'offline',
                user: $userPayload,
                asset: $assetPayload,
                job: $jobPayload,
                isAssigned: $isAssigned,
                assignmentStatus: $assignmentStatus,
                recordedLocation: $asset->location,
                hasGpsReport: false,
                freshnessLabel: 'No GPS report',
            );
        })->sortByDesc(static function (LatestLocationDto $dto): string {
            $time = ($dto->receivedAt ?? $dto->capturedAt)?->toIso8601String() ?? '';
            $code = $dto->asset['code'] ?? '';

            return sprintf('%s_%s', $time, $code);
        })->values();
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
            // Rank before limiting so historical rows cannot crowd out active work.
            ->orderByRaw("CASE WHEN status IN ('dispatched', 'accepted', 'en_route', 'arrived', 'working') THEN 0 WHEN status IN ('draft', 'pending_approval', 'scheduled') THEN 1 ELSE 2 END")
            ->orderByRaw("CASE WHEN status NOT IN ('completed', 'cancelled') AND scheduled_start IS NULL THEN 0 ELSE 1 END")
            ->orderByRaw("CASE WHEN status NOT IN ('completed', 'cancelled') THEN scheduled_start END ASC")
            ->orderByRaw("CASE WHEN status IN ('completed', 'cancelled') THEN updated_at END DESC")
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
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
                'activeOperatorShift.user:id,name',
                'activeOperatorShift.activeDutyLog',
                'latestDvirInspection.photos',
                'latestDvirInspection.checks',
                'dvirInspections' => fn ($query) => $query->latest('completed_at')->limit(15),
                'dvirInspections.photos',
                'dvirInspections.checks',
                'activeBlockingWorkOrder',
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
                'shift.user:id,name',
                'logs.recorder:id,name',
                'logs.attachments',
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
        if (! $user->can(PermissionName::UsersManage->value)) {
            return collect();
        }

        return User::query()
            ->with(['roles:id,name', 'personnelProfile', 'personnelCredentials'])
            ->orderBy('name')
            ->limit($limit)
            ->get();
    }

    /** @return Collection<int, User> */
    private function fetchDispatchResourceUsers(User $user, int $limit = 200): Collection
    {
        if (
            ! $user->can(PermissionName::UsersManage->value) &&
            ! $user->can(PermissionName::AssignmentsViewAll->value) &&
            ! $user->can(PermissionName::DispatchViewAll->value)
        ) {
            return collect();
        }

        return User::query()
            ->select(['id', 'name', 'is_active', 'suspended_at'])
            ->with([
                'roles:id,name',
                'personnelProfile:id,user_id,availability_status',
                'personnelCredentials:id,user_id',
            ])
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
            ->with([
                'job:id,reference,title',
                'job.dvirInspections:id,dispatch_job_id,inspection_type,has_defects,critical_defects_count',
                'job.fuelRequests:id,dispatch_job_id,reference,quantity_litres',
                'author:id,name',
                'attachments',
            ])
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
