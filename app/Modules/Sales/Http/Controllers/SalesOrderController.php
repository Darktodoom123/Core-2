<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\FulfillSalesOrder;
use App\Modules\Sales\Actions\TransferSalesOwnership;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

final class SalesOrderController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::SalesView->value);

        return response()->json(['data' => SalesOrder::query()->with(['client', 'items.catalogItem'])->latest()->paginate(50)]);
    }

    public function fulfill(SalesOrder $salesOrder, FulfillSalesOrder $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($salesOrder, request()->user())]);
    }

    public function transferOwnership(SalesOrder $salesOrder, TransferSalesOwnership $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($salesOrder, request()->user())]);
    }
}
