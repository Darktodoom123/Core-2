<?php

namespace App\Modules\Sales\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\AcceptSalesQuote;
use App\Modules\Sales\Actions\CreateSalesQuote;
use App\Modules\Sales\Http\Requests\StoreSalesQuoteRequest;
use App\Modules\Sales\Models\SalesQuote;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

final class SalesQuoteController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::SalesView->value);

        return response()->json(['data' => SalesQuote::query()->with(['client', 'items.catalogItem'])->latest()->paginate(50)]);
    }

    public function store(StoreSalesQuoteRequest $request, CreateSalesQuote $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($request->user(), $request->validated())], 201);
    }

    public function accept(SalesQuote $salesQuote, AcceptSalesQuote $action): JsonResponse
    {
        Gate::authorize(PermissionName::SalesApproveOrder->value);

        return response()->json(['data' => $action->handle($salesQuote, request()->user())], 201);
    }
}
