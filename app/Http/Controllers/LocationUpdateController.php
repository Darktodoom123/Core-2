<?php

namespace App\Http\Controllers;

use App\Enums\PermissionName;
use App\Http\Requests\StoreLocationUpdateRequest;
use App\Models\LocationUpdate;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

final class LocationUpdateController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::TrackingViewAll->value);

        return response()->json(['data' => LocationUpdate::query()->with('user')->latest('captured_at')->paginate(100)]);
    }

    public function store(StoreLocationUpdateRequest $request): JsonResponse
    {
        $location = LocationUpdate::query()->create([...$request->validated(), 'user_id' => $request->user()->id, 'source' => 'mobile', 'received_at' => now()]);

        return response()->json(['data' => $location], 201);
    }
}
