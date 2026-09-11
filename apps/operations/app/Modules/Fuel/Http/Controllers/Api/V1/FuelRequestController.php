<?php

namespace App\Modules\Fuel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Fuel\Actions\MobileFuelContexts;
use App\Modules\Fuel\Actions\SubmitMobileFuelRequest;
use App\Modules\Fuel\Actions\TransitionFuelRequest;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Http\Requests\StoreMobileFuelLog;
use App\Modules\Fuel\Http\Requests\StoreMobileFuelRequest;
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
            ->with(['asset', 'job', 'logs'])
            ->latest()
            ->paginate(25);

        return FuelRequestResource::collection($fuelRequests)->response();
    }

    public function show(Request $request, FuelRequest $fuelRequest): JsonResponse
    {
        abort_unless(Gate::forUser($request->user())->allows('view', $fuelRequest), 404);

        return response()->json(['data' => new FuelRequestResource($fuelRequest->load(['asset', 'job', 'logs']))]);
    }

    public function store(StoreMobileFuelRequest $request, SubmitMobileFuelRequest $action): JsonResponse
    {
        $fuel = $action->handle($request->user(), $request->validated());

        return response()->json(['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))], $fuel->wasRecentlyCreated ? 201 : 200);
    }

    public function record(StoreMobileFuelLog $request, FuelRequest $fuelRequest, TransitionFuelRequest $action): JsonResponse
    {
        $fuel = $action->handle($request->user(), $fuelRequest, FuelRequestStatus::Logged, null, $request->validated());

        return response()->json(['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))], 201);
    }

    public function options(Request $request, MobileFuelContexts $contexts): JsonResponse
    {
        Gate::authorize('viewAny', FuelRequest::class);

        return response()->json(['data' => [
            'can_request' => $request->user()->can('create', FuelRequest::class),
            'assets' => $contexts->assets($request->user())->orderBy('code')->get(['id', 'code', 'name', 'meter_type', 'meter_value']),
            'jobs' => $contexts->jobs($request->user())->with(['assetAssignments' => fn ($query) => $query->active()])->latest()->get()->map(fn ($job) => [
                'id' => $job->id, 'reference' => $job->reference, 'title' => $job->title,
                'operational_asset_ids' => $job->assetAssignments->pluck('operational_asset_id')->values(),
            ]),
        ]]);
    }
}
