<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('keeps the forward Rental/Sales schema boundaries and explicit indexes', function (): void {
    $indexes = collect(Schema::getIndexes('ownership_transfers'));

    expect(Schema::getColumnType('sales_orders', 'reference'))->toBe('varchar')
        ->and($indexes->pluck('name'))->toContain('ownership_transfers_operational_asset_id_unique')
        ->and(collect(Schema::getIndexes('sales_order_items'))->pluck('name'))
        ->toContain('sales_order_items_catalog_item_order_index');
});

it('rolls the R1 schema migration back and forward without losing the contract', function (): void {
    $migration = require base_path('database/migrations/2026_08_12_100000_align_rental_sales_schema.php');

    $migration->down();

    try {
        expect(collect(Schema::getIndexes('ownership_transfers'))->pluck('name'))
            ->not->toContain('ownership_transfers_operational_asset_id_unique');
    } finally {
        $migration->up();
    }

    expect(Schema::getColumnType('sales_orders', 'reference'))->toBe('varchar')
        ->and(collect(Schema::getIndexes('ownership_transfers'))->pluck('name'))
        ->toContain('ownership_transfers_operational_asset_id_unique');
});
