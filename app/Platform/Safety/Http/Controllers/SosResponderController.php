<?php

namespace App\Platform\Safety\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Safety\Actions\AcknowledgeSosIncident;
use App\Platform\Safety\Actions\CancelSosIncident;
use App\Platform\Safety\Actions\ResolveSosIncident;
use App\Platform\Safety\Enums\SosResolutionCode;
use App\Platform\Safety\Http\Requests\AcknowledgeSosIncidentRequest;
use App\Platform\Safety\Http\Requests\CancelSosIncidentRequest;
use App\Platform\Safety\Http\Requests\ResolveSosIncidentRequest;
use App\Platform\Safety\Http\Resources\SosIncidentResource;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

final class SosResponderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', SosIncident::class);
        $incidents = SosIncident::query()->unresolved()->with(['reporter', 'dispatchJob', 'operationalAsset', 'acknowledgedBy'])->latest('received_at')->limit(100)->get();

        return response()->json(['data' => SosIncidentResource::collection($incidents)]);
    }

    public function show(Request $request, SosIncident $sosIncident): JsonResponse
    {
        Gate::authorize('view', $sosIncident);

        return response()->json(['data' => new SosIncidentResource($sosIncident->load(['reporter', 'dispatchJob', 'operationalAsset', 'acknowledgedBy']))]);
    }

    public function acknowledge(AcknowledgeSosIncidentRequest $request, SosIncident $sosIncident, AcknowledgeSosIncident $action): JsonResponse
    {
        $updated = $action->handle($request->user(), $sosIncident)->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json(['data' => new SosIncidentResource($updated)]);
    }

    public function resolve(ResolveSosIncidentRequest $request, SosIncident $sosIncident, ResolveSosIncident $action): JsonResponse
    {
        $updated = $action->handle(
            $request->user(),
            $sosIncident,
            SosResolutionCode::from((string) $request->validated('resolution_code')),
            (string) $request->validated('resolution_notes'),
        )->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json(['data' => new SosIncidentResource($updated)]);
    }

    public function cancel(CancelSosIncidentRequest $request, SosIncident $sosIncident, CancelSosIncident $action): JsonResponse
    {
        $updated = $action->handle($request->user(), $sosIncident, (string) $request->validated('cancellation_reason'))
            ->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json(['data' => new SosIncidentResource($updated)]);
    }
}
