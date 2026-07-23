<?php

namespace App\Http\Controllers;

use App\Enums\PermissionName;
use App\Http\Requests\StoreLocationUpdateRequest;
use App\Models\LocationUpdate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class LocationUpdateController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::TrackingViewAll->value);

        return response()->json(['data' => LocationUpdate::query()->with('user')->latest('captured_at')->paginate(100)]);
    }

    public function store(StoreLocationUpdateRequest $request): RedirectResponse
    {
        LocationUpdate::query()->create([...$request->validated(), 'user_id' => $request->user()->id, 'source' => 'browser', 'received_at' => now()]);

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => 'Your current location was shared.',
        ]);
    }
}
