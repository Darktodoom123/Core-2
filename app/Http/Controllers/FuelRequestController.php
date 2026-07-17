<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Actions\TransitionFuelRequest;
use App\Enums\FuelRequestStatus;
use App\Http\Requests\StoreFuelRequest;
use App\Models\FuelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class FuelRequestController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', FuelRequest::class);

        return response()->json(['data' => FuelRequest::query()->visibleTo(request()->user())->latest()->paginate(25)]);
    }

    public function store(StoreFuelRequest $request, RecordAuditEvent $audit): JsonResponse
    {
        $fuel = FuelRequest::query()->create([...$request->validated(), 'reference' => 'FUEL-'.now()->format('YmdHis').'-'.$request->user()->id, 'requester_id' => $request->user()->id, 'status' => FuelRequestStatus::Submitted]);
        $audit->handle($request->user(), $fuel, 'fuel.requested', null, $fuel->toArray());

        return response()->json(['data' => $fuel], 201);
    }

    public function transition(Request $request, FuelRequest $fuelRequest, TransitionFuelRequest $action): JsonResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::enum(FuelRequestStatus::class)], 'reason' => ['nullable', 'string', 'max:2000']]);

        return response()->json(['data' => $action->handle($request->user(), $fuelRequest, FuelRequestStatus::from($validated['status']), $validated['reason'] ?? null)]);
    }
}
