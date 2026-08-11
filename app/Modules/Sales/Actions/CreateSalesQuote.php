<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Sales\Enums\SalesQuoteStatus;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CreateSalesQuote
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array<string, mixed> $attributes */
    public function handle(User $actor, array $attributes): SalesQuote
    {
        return DB::transaction(function () use ($actor, $attributes): SalesQuote {
            $quote = SalesQuote::query()->create([
                'reference' => $attributes['reference'],
                'client_id' => $attributes['client_id'],
                'created_by' => $actor->id,
                'status' => SalesQuoteStatus::Draft,
                'currency' => strtoupper((string) ($attributes['currency'] ?? 'PHP')),
                'valid_until' => $attributes['valid_until'] ?? null,
                'notes' => $attributes['notes'] ?? null,
            ]);
            $total = 0;
            $catalogIds = [];
            foreach ((array) $attributes['items'] as $item) {
                $catalogId = (int) $item['sales_catalog_item_id'];
                if (isset($catalogIds[$catalogId])) {
                    throw ValidationException::withMessages(['items' => 'Each catalog item may appear only once on a quote.']);
                }
                $catalogIds[$catalogId] = true;
                $catalog = SalesCatalogItem::query()->lockForUpdate()->findOrFail($catalogId);
                if ($catalog->status !== 'active') {
                    throw ValidationException::withMessages(['items' => "Catalog item {$catalog->sku} is no longer active."]);
                }
                $quantity = (int) $item['quantity'];
                if ($catalog->operational_asset_id !== null && $quantity !== 1) {
                    throw ValidationException::withMessages(['items' => "Saleable unit {$catalog->sku} can only be quoted once."]);
                }
                $line = $catalog->unit_price_cents * $quantity;
                $total += $line;
                $quote->items()->create([
                    'sales_catalog_item_id' => $catalog->id,
                    'quantity' => $quantity,
                    'unit_price_cents' => $catalog->unit_price_cents,
                    'line_total_cents' => $line,
                ]);
            }
            $quote->update(['total_cents' => $total]);
            $this->audit->handle($actor, $quote, 'sales_quote.created', null, $quote->fresh()->toArray());

            return $quote->fresh(['items.catalogItem', 'client']);
        });
    }
}
