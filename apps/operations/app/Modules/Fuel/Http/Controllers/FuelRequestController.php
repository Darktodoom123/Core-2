<?php

namespace App\Modules\Fuel\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Fuel\Actions\TransitionFuelRequest;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Http\Requests\StoreFuelRequest;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Attachments\Services\AttachmentFilePolicy;
use App\Platform\Audit\Actions\RecordAuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final class FuelRequestController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', FuelRequest::class);

        return response()->json(['data' => FuelRequest::query()->visibleTo(request()->user())->latest()->paginate(25)]);
    }

    public function store(StoreFuelRequest $request, RecordAuditEvent $audit): RedirectResponse
    {
        $fuel = FuelRequest::query()->create([...$request->validated(), 'reference' => 'FUEL-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)), 'requester_id' => $request->user()->id, 'status' => FuelRequestStatus::Submitted]);
        $audit->handle($request->user(), $fuel, 'fuel.requested', null, $fuel->toArray());

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Fuel request {$fuel->reference} was submitted.",
        ]);
    }

    public function transition(Request $request, FuelRequest $fuelRequest, TransitionFuelRequest $action): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(FuelRequestStatus::class)],
            'reason' => ['nullable', 'string', 'max:2000'],
            'quantity_litres' => ['nullable', 'numeric', 'gt:0', 'max:100000'],
            'odometer_km' => ['nullable', 'integer', 'min:0'],
            'hour_meter' => ['nullable', 'numeric', 'min:0'],
            'price_per_litre' => ['nullable', 'numeric', 'min:0'],
            'total_cost' => ['nullable', 'numeric', 'min:0'],
            'fuel_station' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'receipt' => ['nullable', 'file', 'max:15360'],
        ]);

        if (($validated['receipt'] ?? null) instanceof UploadedFile) {
            try {
                AttachmentFilePolicy::validate($validated['receipt']);
            } catch (InvalidArgumentException $exception) {
                throw ValidationException::withMessages(['receipt' => $exception->getMessage()]);
            }
        }

        $status = FuelRequestStatus::from($validated['status']);
        $action->handle($request->user(), $fuelRequest, $status, $validated['reason'] ?? null, $validated);

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Fuel request {$fuelRequest->reference} is now {$status->label()}.",
        ]);
    }
}
