<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Sales\Http\Requests\StoreSalesCatalogItemRequest;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class SalesCatalogController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::SalesView->value);

        return response()->json(['data' => SalesCatalogItem::query()->with('asset')->where('status', 'active')->orderBy('sku')->paginate(50)]);
    }

    public function store(StoreSalesCatalogItemRequest $request, RecordAuditEvent $audit): JsonResponse
    {
        $item = DB::transaction(function () use ($request, $audit): SalesCatalogItem {
            Gate::forUser($request->user())->authorize(PermissionName::SalesCatalogManage->value);
            $item = SalesCatalogItem::query()->create([...$request->validated(), 'status' => 'active']);
            $quantity = (int) $item->quantity_on_hand;
            if ($quantity > 0) {
                DB::table('sales_inventory_ledger')->insert([
                    'sales_catalog_item_id' => $item->id,
                    'created_by' => $request->user()->id,
                    'entry_type' => 'initial_stock',
                    'quantity_delta' => $quantity,
                    'metadata' => json_encode(['source' => 'catalog'], JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
            $audit->handle($request->user(), $item, 'sales_catalog_item.created', null, $item->toArray());

            return $item;
        });

        return response()->json(['data' => $item->load('asset')], 201);
    }
}
