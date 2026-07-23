<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Actions\TransitionFuelRequest;
use App\Enums\FuelRequestStatus;
use App\Http\Requests\StoreFuelRequest;
use App\Models\FuelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
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

    public function store(StoreFuelRequest $request, RecordAuditEvent $audit): RedirectResponse
    {
        $fuel = FuelRequest::query()->create([...$request->validated(), 'reference' => 'FUEL-'.now()->format('YmdHis').'-'.$request->user()->id, 'requester_id' => $request->user()->id, 'status' => FuelRequestStatus::Submitted]);
        $audit->handle($request->user(), $fuel, 'fuel.requested', null, $fuel->toArray());

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Fuel request {$fuel->reference} was submitted.",
        ]);
    }

    public function transition(Request $request, FuelRequest $fuelRequest, TransitionFuelRequest $action): RedirectResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::enum(FuelRequestStatus::class)], 'reason' => ['nullable', 'string', 'max:2000']]);
        $status = FuelRequestStatus::from($validated['status']);
        $action->handle($request->user(), $fuelRequest, $status, $validated['reason'] ?? null);

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Fuel request {$fuelRequest->reference} is now {$status->label()}.",
        ]);
    }
}
