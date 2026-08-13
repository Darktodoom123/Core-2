<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Support\PersistedInteger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CreateSalesQuote
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array<string, mixed> $attributes */
    public function handle(User $actor, array $attributes): SalesQuote
    {
        return DB::transaction(function () use ($actor, $attributes): SalesQuote {
            $items = array_values((array) ($attributes['items'] ?? []));
            if ($items === [] || count($items) > 100) {
                throw ValidationException::withMessages(['items' => 'A quote must contain between one and 100 items.']);
            }

            $catalogIds = [];
            foreach ($items as $item) {
                if (! is_array($item)) {
                    throw ValidationException::withMessages(['items' => 'Each quote item must be an object.']);
                }

                $catalogId = (int) ($item['sales_catalog_item_id'] ?? 0);
                if ($catalogId < 1 || isset($catalogIds[$catalogId])) {
                    throw ValidationException::withMessages(['items' => 'Each catalog item may appear only once on a quote.']);
                }
                $catalogIds[$catalogId] = true;
            }

            $catalogs = SalesCatalogItem::query()
                ->whereIn('id', array_keys($catalogIds))
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $total = 0;
            $calculatedItems = [];
            foreach ($items as $item) {
                $catalogId = (int) $item['sales_catalog_item_id'];
                $catalog = $catalogs->get($catalogId);
                if (! $catalog instanceof SalesCatalogItem || $catalog->status !== 'active') {
                    throw ValidationException::withMessages(['items' => 'One or more catalog items are no longer active.']);
                }

                $quantity = (int) ($item['quantity'] ?? 0);
                if ($quantity < 1 || $quantity > PersistedInteger::MAX) {
                    throw ValidationException::withMessages(['items' => 'Each quote quantity must be between one and the supported maximum.']);
                }
                if ($catalog->operational_asset_id !== null && $quantity !== 1) {
                    throw ValidationException::withMessages(['items' => "Saleable unit {$catalog->sku} can only be quoted once."]);
                }

                $unitPrice = PersistedInteger::checkedAdd((int) $catalog->unit_price_cents, 0, 'items');

                $line = PersistedInteger::checkedMultiply($quantity, $unitPrice, 'items');
                $total = PersistedInteger::checkedAdd($total, $line, 'items');
                $calculatedItems[] = [$catalog, $quantity, $unitPrice, $line];
            }

            Gate::forUser($actor)->authorize(PermissionName::SalesCreateQuote->value);

            $quote = SalesQuote::query()->create([
                'reference' => $attributes['reference'],
                'client_id' => $attributes['client_id'],
                'created_by' => $actor->id,
                'status' => SalesQuoteStatus::Draft,
                'currency' => strtoupper((string) ($attributes['currency'] ?? 'PHP')),
                'valid_until' => $attributes['valid_until'] ?? null,
                'notes' => $attributes['notes'] ?? null,
            ]);
            foreach ($calculatedItems as [$catalog, $quantity, $unitPrice, $line]) {
                $quote->items()->create([
                    'sales_catalog_item_id' => $catalog->id,
                    'quantity' => $quantity,
                    'unit_price_cents' => $unitPrice,
                    'line_total_cents' => $line,
                ]);
            }
            $quote->update(['total_cents' => $total]);
            $this->audit->handle($actor, $quote, 'sales_quote.created', null, $quote->fresh()->toArray());

            return $quote->fresh(['items.catalogItem', 'client']);
        });
    }
}
