<?php

namespace App\Modules\Fuel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Fuel\Http\Resources\V1\FuelRequestResource;
use App\Modules\Fuel\Models\FuelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

final class FuelRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', FuelRequest::class);

        $fuelRequests = FuelRequest::query()
            ->visibleTo($request->user())
            ->latest()
            ->paginate(25);

        return FuelRequestResource::collection($fuelRequests)->response();
    }

    public function show(Request $request, FuelRequest $fuelRequest): JsonResponse
    {
        abort_unless(Gate::forUser($request->user())->allows('view', $fuelRequest), 404);

        return response()->json(['data' => new FuelRequestResource($fuelRequest)]);
    }
}
