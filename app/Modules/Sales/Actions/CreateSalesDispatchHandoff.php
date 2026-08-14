<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Dispatch\Actions\CreateDispatchFromSource;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesOrderItem;
use App\Modules\Sales\Support\SalesAuditSnapshot;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CreateSalesDispatchHandoff
{
    public function __construct(
        private readonly CreateDispatchFromSource $dispatch,
        private readonly OperationalAssetAvailability $availability,
        private readonly RecordAuditEvent $audit,
    ) {}

    /** @param array<string, mixed> $attributes */
    public function handle(SalesOrder $order, User $actor, array $attributes): DispatchJob
    {
        return DB::transaction(function () use ($order, $actor, $attributes): DispatchJob {
            $locked = SalesOrder::query()->with('client')->lockForUpdate()->findOrFail($order->id);
            Gate::forUser($actor)->authorize(PermissionName::SalesView->value);

            if (! $locked->requiresDispatch()) {
                throw ValidationException::withMessages(['fulfillment_mode' => 'Pickup orders do not create dispatch work.']);
            }
            if ($locked->dispatch_job_id !== null) {
                return $locked->dispatchJob()->firstOrFail();
            }
            if ($locked->status !== SalesOrderStatus::Confirmed) {
                throw ValidationException::withMessages(['status' => 'Only confirmed orders can create delivery dispatch work.']);
            }
            if (trim((string) $locked->delivery_location) === '') {
                throw ValidationException::withMessages(['delivery_location' => 'A delivery location is required before dispatch work can be created.']);
            }

            $items = SalesOrderItem::query()
                ->where('sales_order_id', $locked->id)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $catalogs = SalesCatalogItem::query()
                ->whereIn('id', $items->pluck('sales_catalog_item_id')->all())
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $assets = $this->availability->lockAssetsForUpdate($catalogs->pluck('operational_asset_id')->filter()->all());

            foreach ($items as $item) {
                $catalog = $catalogs->get($item->sales_catalog_item_id);
                if (! $catalog instanceof SalesCatalogItem || (int) $catalog->quantity_reserved < (int) $item->quantity) {
                    throw ValidationException::withMessages(['items' => 'Reserved sales inventory is no longer available.']);
                }
                if ($catalog->operational_asset_id === null) {
                    continue;
                }
                if (! $assets->has($catalog->operational_asset_id)) {
                    throw ValidationException::withMessages(['items' => 'One or more saleable assets are no longer available.']);
                }

                $this->availability->assertNoConflict(new AssetUsageRequest(
                    assetId: (int) $catalog->operational_asset_id,
                    usageType: AssetUsageType::SalesFulfill,
                    source: new AssetUsageSource('sales_order', (int) $locked->id),
                ), 'items');
            }

            $before = SalesAuditSnapshot::fromOrder($locked);
            $job = $this->dispatch->handle($actor, $locked, DispatchSourceType::SalesOrder, [
                'reference' => 'SALE-DSP-'.$locked->id,
                'client' => (string) $locked->client->company_name,
                'title' => 'Sales delivery '.$locked->reference,
                'site' => trim((string) $locked->delivery_location),
                'site_notes' => $attributes['site_notes'] ?? null,
                'scheduled_start' => $attributes['scheduled_start'],
                'scheduled_end' => $attributes['scheduled_end'],
                'priority' => $attributes['priority'] ?? DispatchPriority::Routine,
                'requirements' => $attributes['requirements'] ?? [],
            ]);

            $locked->update(['dispatch_job_id' => $job->id]);
            $this->audit->handle($actor, $locked, 'sales_order.dispatch_linked', $before, SalesAuditSnapshot::fromOrder($locked->fresh()));

            return $job;
        });
    }
}
