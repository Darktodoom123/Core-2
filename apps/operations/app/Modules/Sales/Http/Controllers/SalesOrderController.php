<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\CreateSalesDispatchHandoff;
use App\Modules\Sales\Actions\FulfillSalesOrder;
use App\Modules\Sales\Actions\TransferSalesOwnership;
use App\Modules\Sales\Http\Requests\CreateSalesDispatchHandoffRequest;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class SalesOrderController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::SalesView->value);

        return response()->json(['data' => SalesOrder::query()->with(['client', 'items.catalogItem'])->latest()->paginate(50)]);
    }

    public function fulfill(SalesOrder $salesOrder, FulfillSalesOrder $action): JsonResponse|RedirectResponse
    {
        $order = $action->handle($salesOrder, request()->user());

        if (request()->expectsJson() && ! request()->header('X-Inertia')) {
            return response()->json(['data' => $order]);
        }

        return back()->with('flash', [
            'tone' => 'success',
            'message' => "Sales order {$salesOrder->reference} fulfilled successfully.",
        ]);
    }

    public function createDispatch(SalesOrder $salesOrder, CreateSalesDispatchHandoffRequest $request, CreateSalesDispatchHandoff $action): JsonResponse|RedirectResponse
    {
        $job = $action->handle($salesOrder, $request->user(), $request->validated());

        if ($request->expectsJson()) {
            return response()->json(['data' => $job], 201);
        }

        return back()->with('flash', [
            'tone' => 'success',
            'message' => "Sale {$salesOrder->reference} was linked to dispatch {$job->reference}.",
        ]);
    }

    public function transferOwnership(SalesOrder $salesOrder, TransferSalesOwnership $action): JsonResponse|RedirectResponse
    {
        $order = $action->handle($salesOrder, request()->user());

        if (request()->expectsJson() && ! request()->header('X-Inertia')) {
            return response()->json(['data' => $order]);
        }

        return back()->with('flash', [
            'tone' => 'success',
            'message' => "Sales order {$salesOrder->reference} ownership transferred successfully.",
        ]);
    }
}
