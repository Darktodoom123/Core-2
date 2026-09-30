<?php

namespace App\Platform\Workspace\Queries;

use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Rental\Enums\RentalFulfillmentMode;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Rental\ViewModels\RentalHandoffViewModel;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class DispatchDeskIncomingQuery
{
    private const int PER_PAGE = 25;

    /**
     * @return array{
     *     items: list<array{key: string, mode: 'service'|'rental', sourceLabel: string, reference: string, client: string, detail: string, status: string, sourceId: int, hasEvidence?: bool, evidenceSignee?: string|null}>,
     *     service_requests: list<array<string, mixed>>,
     *     rental_handoffs: list<array<string, mixed>>,
     *     total: int,
     *     current_page: int,
     *     last_page: int,
     *     per_page: int
     * }
     */
    public function paginate(User $user, int $page, ?int $focusServiceRequestId = null): array
    {
        $sources = $this->sourceQueries($user);
        $union = $this->union($sources);
        $base = DB::query()->fromSub($union, 'incoming_handoffs');
        $total = (clone $base)->count();
        $lastPage = max(1, (int) ceil($total / self::PER_PAGE));
        $currentPage = min($page, $lastPage);
        $rows = $base
            ->orderBy('created_at')
            ->orderBy('source_type')
            ->orderBy('id')
            ->offset(($currentPage - 1) * self::PER_PAGE)
            ->limit(self::PER_PAGE)
            ->get();

        $idsBySource = $rows->groupBy('source_type')->map(
            static fn (Collection $sourceRows): array => array_values($sourceRows->pluck('id')->map(static fn (mixed $id): int => (int) $id)->all()),
        );

        $serviceIds = $idsBySource->get('service', []);
        $serviceRequests = $this->serviceRequests($serviceIds);
        $serviceQuery = $sources['service'] ?? null;
        if ($focusServiceRequestId !== null && $serviceQuery !== null && ! in_array($focusServiceRequestId, $serviceIds, true)) {
            $focusExists = (clone $serviceQuery)
                ->where('incoming.id', $focusServiceRequestId)
                ->exists();

            if ($focusExists) {
                $serviceRequests = [...$serviceRequests, ...$this->serviceRequests([$focusServiceRequestId])];
            }
        }
        $rentalHandoffs = $this->rentalHandoffs($idsBySource->get('rental', []));
        $serviceById = collect($serviceRequests)->keyBy('id');
        $rentalById = collect($rentalHandoffs)->keyBy('id');

        $items = [];
        foreach ($rows as $row) {
            $id = (int) $row->id;
            $item = match ($row->source_type) {
                'service' => $this->serviceItem($serviceById->get($id)),
                'rental' => $this->rentalItem($rentalById->get($id)),
                default => null,
            };

            if ($item !== null) {
                $items[] = $item;
            }
        }

        return [
            'items' => $items,
            'service_requests' => $serviceRequests,
            'rental_handoffs' => $rentalHandoffs,
            'total' => $total,
            'current_page' => $currentPage,
            'last_page' => $lastPage,
            'per_page' => self::PER_PAGE,
        ];
    }

    /** @return array{total: int, by_source: array{service: int, rental: int}} */
    public function counts(User $user): array
    {
        $counts = [];
        foreach ($this->sourceQueries($user) as $source => $query) {
            $counts[$source] = (int) DB::query()->fromSub($query, 'incoming_source')->count();
        }

        $counts += ['service' => 0, 'rental' => 0];

        return [
            'total' => array_sum($counts),
            'by_source' => $counts,
        ];
    }

    /** @return array<string, Builder> */
    private function sourceQueries(User $user): array
    {
        if (! $user->can(PermissionName::DispatchCreate->value)) {
            return [];
        }

        $queries = [
            'service' => DB::table('service_requests as incoming')
                ->join('clients as client', 'client.id', '=', 'incoming.client_id')
                ->whereNull('client.deleted_at')
                ->whereNull('incoming.deleted_at')
                ->whereIn('incoming.status', ['submitted', 'dispatching'])
                ->whereNotExists(static fn (Builder $jobs) => $jobs
                    ->selectRaw('1')
                    ->from('dispatch_jobs')
                    ->whereColumn('dispatch_jobs.service_request_id', 'incoming.id')
                    ->whereNull('dispatch_jobs.deleted_at'))
                ->selectRaw("'service' as source_type, incoming.id, incoming.created_at"),
        ];

        if ($user->can(PermissionName::RentalView->value)) {
            $queries['rental'] = DB::table('rental_reservations as incoming')
                ->join('clients as client', 'client.id', '=', 'incoming.client_id')
                ->whereNull('client.deleted_at')
                ->whereNull('incoming.deleted_at')
                ->where('incoming.status', 'reserved')
                ->where('incoming.fulfillment_mode', RentalFulfillmentMode::Delivery->value)
                ->whereNull('incoming.dispatch_job_id')
                ->selectRaw("'rental' as source_type, incoming.id, incoming.created_at");
        }

        return $queries;
    }

    /** @param array<string, Builder> $sources */
    private function union(array $sources): Builder
    {
        $queries = array_values($sources);
        $union = array_shift($queries) ?? DB::query()
            ->selectRaw('CAST(NULL AS VARCHAR(16)) as source_type, CAST(NULL AS BIGINT) as id, CAST(NULL AS TIMESTAMP) as created_at')
            ->whereRaw('1 = 0');

        foreach ($queries as $query) {
            $union->unionAll($query);
        }

        return $union;
    }

    /** @param list<int> $ids
     * @return list<array<string, mixed>>
     */
    private function serviceRequests(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $requests = ServiceRequest::query()
            ->with('client:id,code,company_name')
            ->withCount('dispatchJobs')
            ->whereKey($ids)
            ->get()
            ->keyBy('id');

        return array_values(OperationsWorkspaceViewModel::serviceRequests($requests->values()));
    }

    /** @param list<int> $ids
     * @return list<array<string, mixed>>
     */
    private function rentalHandoffs(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $reservations = RentalReservation::query()
            ->with(['client:id,code,company_name', 'latestHandoverEvidence', 'items.asset:id,code,name,kind'])
            ->whereKey($ids)
            ->get();

        return array_values(RentalHandoffViewModel::collection($reservations));
    }

    /** @param array<string, mixed>|null $request
     * @return array{key: string, mode: 'service', sourceLabel: string, reference: string, client: string, detail: string, status: string, sourceId: int}|null
     */
    private function serviceItem(?array $request): ?array
    {
        if ($request === null) {
            return null;
        }

        return [
            'key' => 'service-'.$request['id'],
            'mode' => 'service',
            'sourceLabel' => 'Service request',
            'reference' => $request['reference'],
            'client' => $request['client']['company_name'],
            'detail' => $request['project_name'] ?: ($request['service_type'] ?: ($request['location'] ?: 'Service demand awaiting dispatch')),
            'status' => $request['status']['label'],
            'sourceId' => $request['id'],
        ];
    }

    /** @param array<string, mixed>|null $handoff
     * @return array{key: string, mode: 'rental', sourceLabel: string, reference: string, client: string, detail: string, status: string, sourceId: int, hasEvidence: bool, evidenceSignee: string|null}|null
     */
    private function rentalItem(?array $handoff): ?array
    {
        if ($handoff === null) {
            return null;
        }

        return [
            'key' => 'rental-'.$handoff['id'],
            'mode' => 'rental',
            'sourceLabel' => 'Rental delivery',
            'reference' => $handoff['reference'],
            'client' => $handoff['client']['company_name'],
            'detail' => $handoff['location'] ?: 'Delivery location needs review',
            'status' => $handoff['status']['label'],
            'sourceId' => $handoff['id'],
            'hasEvidence' => $handoff['has_evidence'],
            'evidenceSignee' => $handoff['evidence_signee'],
        ];
    }
}
