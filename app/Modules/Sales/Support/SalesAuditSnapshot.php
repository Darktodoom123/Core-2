<?php

namespace App\Modules\Sales\Support;

use App\Modules\Sales\Models\SalesCatalogItem;
use App\Modules\Sales\Models\SalesOrder;
use App\Modules\Sales\Models\SalesQuote;
use Illuminate\Support\Arr;

final class SalesAuditSnapshot
{
    /** @return array<string, mixed> */
    public static function fromCatalogItem(SalesCatalogItem $item): array
    {
        return array_replace(array_fill_keys([
            'id',
            'sku',
            'name',
            'unit_price_cents',
            'quantity_on_hand',
            'quantity_reserved',
            'operational_asset_id',
            'status',
            'created_at',
            'updated_at',
        ], null), Arr::only($item->toArray(), [
            'id', 'sku', 'name', 'unit_price_cents', 'quantity_on_hand', 'quantity_reserved',
            'operational_asset_id', 'status', 'created_at', 'updated_at',
        ]));
    }

    /** @return array<string, mixed> */
    public static function fromQuote(SalesQuote $quote): array
    {
        return array_replace(array_fill_keys([
            'id',
            'reference',
            'client_id',
            'created_by',
            'status',
            'currency',
            'total_cents',
            'valid_until',
            'created_at',
            'updated_at',
        ], null), Arr::only($quote->toArray(), [
            'id', 'reference', 'client_id', 'created_by', 'status', 'currency', 'total_cents',
            'valid_until', 'created_at', 'updated_at',
        ]));
    }

    /** @return array<string, mixed> */
    public static function fromOrder(SalesOrder $order): array
    {
        return array_replace(array_fill_keys([
            'id',
            'reference',
            'client_id',
            'sales_quote_id',
            'created_by',
            'dispatch_job_id',
            'fulfillment_mode',
            'status',
            'currency',
            'total_cents',
            'fulfilled_at',
            'created_at',
            'updated_at',
        ], null), Arr::only($order->toArray(), [
            'id', 'reference', 'client_id', 'sales_quote_id', 'created_by', 'dispatch_job_id', 'fulfillment_mode', 'status', 'currency',
            'total_cents', 'fulfilled_at', 'created_at', 'updated_at',
        ]));
    }
}
