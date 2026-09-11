<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const ORDER_REFERENCE_LENGTH = 64;

    private const OWNERSHIP_INDEX = 'ownership_transfers_operational_asset_id_unique';

    private const ORDER_ITEM_CONFLICT_INDEX = 'sales_order_items_catalog_item_order_index';

    public function up(): void
    {
        $duplicates = DB::table('ownership_transfers')
            ->select('operational_asset_id', DB::raw('count(*) as transfer_count'))
            ->whereNotNull('operational_asset_id')
            ->groupBy('operational_asset_id')
            ->havingRaw('count(*) > 1')
            ->orderBy('operational_asset_id')
            ->get();

        if ($duplicates->isNotEmpty()) {
            $details = $duplicates
                ->map(fn (object $duplicate): string => sprintf(
                    '%s (%s)',
                    $duplicate->operational_asset_id,
                    $duplicate->transfer_count,
                ))
                ->implode(', ');

            throw new RuntimeException(
                'Cannot add the ownership transfer uniqueness constraint; duplicate operational_asset_id values: '.$details,
            );
        }

        Schema::table('sales_orders', function (Blueprint $table): void {
            $table->string('reference', self::ORDER_REFERENCE_LENGTH)->change();
        });

        Schema::table('ownership_transfers', function (Blueprint $table): void {
            $table->unique('operational_asset_id', self::OWNERSHIP_INDEX);
        });

        // The Sales conflict checker filters order items by catalog item and
        // then joins to order status. This is the measured supporting index;
        // Rental's equivalent asset/window indexes already exist in the base
        // migration.
        Schema::table('sales_order_items', function (Blueprint $table): void {
            $table->index(
                ['sales_catalog_item_id', 'sales_order_id'],
                self::ORDER_ITEM_CONFLICT_INDEX,
            );
        });
    }

    public function down(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table): void {
            $table->dropIndex(self::ORDER_ITEM_CONFLICT_INDEX);
        });

        Schema::table('ownership_transfers', function (Blueprint $table): void {
            $table->dropUnique(self::OWNERSHIP_INDEX);
        });

        Schema::table('sales_orders', function (Blueprint $table): void {
            $table->string('reference', 48)->change();
        });
    }
};
