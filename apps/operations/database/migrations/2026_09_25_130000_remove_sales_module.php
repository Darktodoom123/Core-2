<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

/**
 * Core-2 no longer performs sales fulfillment. This drops the sales tables,
 * converts sale-sourced dispatches to direct (manual) dispatches so they stay
 * loadable and auditable, and removes sales permissions and polymorphic rows
 * that point at deleted sales models. Audit events are kept as history.
 */
return new class extends Migration
{
    /** Dropped child-first so foreign keys never block a drop. */
    private const TABLES = [
        'sales_delivery_evidences',
        'ownership_transfers',
        'sales_inventory_ledger',
        'sales_order_items',
        'sales_orders',
        'sales_quote_items',
        'sales_quotes',
        'sales_catalog_items',
    ];

    /** Morph aliases and class names that pointed at the removed sales models. */
    private const SALES_MORPH_TYPES = [
        'sales_order',
        'App\\Modules\\Sales\\Models\\SalesCatalogItem',
        'App\\Modules\\Sales\\Models\\SalesDeliveryEvidence',
        'App\\Modules\\Sales\\Models\\SalesOrder',
        'App\\Modules\\Sales\\Models\\SalesOrderItem',
        'App\\Modules\\Sales\\Models\\SalesQuote',
        'App\\Modules\\Sales\\Models\\SalesQuoteItem',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $this->convertSaleSourcedDispatches();
            $this->removeSalesMorphRows();
            $this->removeSalesPermissions();
            $this->normalizeSalesBusinessLine();
        });

        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /**
     * Irreversible: sales data and schema are intentionally discarded.
     */
    public function down(): void
    {
        //
    }

    private function convertSaleSourcedDispatches(): void
    {
        if (Schema::hasColumn('dispatch_jobs', 'source_type')) {
            $this->whereSalesType(DB::table('dispatch_jobs'), 'source_type')->update([
                'source_type' => null,
                'source_id' => null,
                'source_reference' => null,
            ]);
        }

        if (! Schema::hasTable('dispatch_handoffs')) {
            return;
        }

        $handoffs = $this->whereSalesType(DB::table('dispatch_handoffs'), 'source_type')
            ->orderBy('id')
            ->get(['id', 'workspace_key', 'source_system', 'legacy_dispatch_job_id']);

        foreach ($handoffs as $handoff) {
            // Direct dispatches key their handoff by the dispatch job id.
            $sourceId = (int) ($handoff->legacy_dispatch_job_id ?? $handoff->id);

            $collides = DB::table('dispatch_handoffs')
                ->where('workspace_key', $handoff->workspace_key)
                ->where('source_system', $handoff->source_system)
                ->where('source_type', 'manual')
                ->where('source_id', $sourceId)
                ->exists();

            if ($collides) {
                throw new RuntimeException(sprintf(
                    'Cannot convert sales dispatch handoff %d to a direct dispatch: a manual handoff for source %d already exists.',
                    $handoff->id,
                    $sourceId,
                ));
            }

            DB::table('dispatch_handoffs')->where('id', $handoff->id)->update([
                'source_type' => 'manual',
                'source_id' => $sourceId,
            ]);
        }
    }

    private function removeSalesMorphRows(): void
    {
        $morphColumns = [
            'attachments' => 'owner_type',
            'notifications' => 'notifiable_type',
            'approval_requests' => 'subject_type',
            'gpt_recommendations' => 'subject_type',
        ];

        foreach ($morphColumns as $table => $column) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, $column)) {
                $this->whereSalesType(DB::table($table), $column)->delete();
            }
        }
    }

    private function removeSalesPermissions(): void
    {
        $tables = config('permission.table_names', []);
        $permissions = $tables['permissions'] ?? 'permissions';

        if (Schema::hasTable($permissions)) {
            // role_has_permissions and model_has_permissions cascade on delete.
            DB::table($permissions)->where('name', 'like', 'sales.%')->delete();
        }
    }

    private function normalizeSalesBusinessLine(): void
    {
        if (Schema::hasColumn('service_requests', 'business_line')) {
            DB::table('service_requests')->where('business_line', 'sales')->update(['business_line' => 'service']);
        }
    }

    private function whereSalesType(Builder $query, string $column): Builder
    {
        return $query->whereIn($column, self::SALES_MORPH_TYPES);
    }
};
