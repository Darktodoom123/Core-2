<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Sales\Http\Requests\StoreSalesCatalogItemRequest;
use App\Modules\Sales\Models\SalesCatalogItem;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

final class SalesCatalogController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::SalesView->value);

        return response()->json(['data' => SalesCatalogItem::query()->with('asset')->where('status', 'active')->orderBy('sku')->paginate(50)]);
    }

    public function store(StoreSalesCatalogItemRequest $request): JsonResponse
    {
        $item = SalesCatalogItem::query()->create([...$request->validated(), 'status' => 'active']);

        return response()->json(['data' => $item->load('asset')], 201);
    }
}
