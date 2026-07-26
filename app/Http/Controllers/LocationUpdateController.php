<?php

namespace App\Http\Controllers;

use App\Enums\PermissionName;
use App\Http\Requests\StoreLocationUpdateRequest;
use App\Models\LocationUpdate;
use App\Services\IdempotentCommandService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class LocationUpdateController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::TrackingViewAll->value);

        return response()->json([
            'data' => LocationUpdate::query()
                ->with(['user:id,name', 'asset:id,code,name', 'job:id,reference,title'])
                ->latest('captured_at')
                ->paginate(100),
        ]);
    }

    public function store(StoreLocationUpdateRequest $request, IdempotentCommandService $idempotency): RedirectResponse|JsonResponse
    {
        $commandId = $request->header('Idempotency-Key') ?: $request->input('command_id');

        $execute = function () use ($request) {
            $data = $request->validated();
            unset($data['command_id']);

            LocationUpdate::query()->create([
                ...$data,
                'user_id' => $request->user()->id,
                'source' => 'browser',
                'received_at' => now(),
            ]);

            return to_route('home')->with('flash', [
                'tone' => 'success',
                'message' => 'Your current location was shared.',
            ]);
        };

        if ($commandId) {
            /** @var RedirectResponse|JsonResponse */
            return $idempotency->process(
                $request->user(),
                (string) $commandId,
                'location.store',
                null,
                $execute,
                collect($request->validated())->except('command_id')->all()
            );
        }

        return $execute();
    }
}
