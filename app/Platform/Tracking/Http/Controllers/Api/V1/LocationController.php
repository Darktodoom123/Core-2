<?php

namespace App\Platform\Tracking\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Tracking\Actions\BroadcastTrackingWorkspaceUpdate;
use App\Platform\Tracking\Http\Requests\StoreLocationUpdateRequest;
use App\Platform\Tracking\Http\Resources\V1\LocationUpdateResource;
use App\Platform\Tracking\Models\LocationUpdate;
use Illuminate\Http\JsonResponse;

final class LocationController extends Controller
{
    public function store(
        StoreLocationUpdateRequest $request,
        IdempotentCommandService $idempotency,
        RecordAuditEvent $audit,
        BroadcastTrackingWorkspaceUpdate $broadcast,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $audit, $broadcast): JsonResponse {
            $data = $request->validated();
            unset($data['command_id']);

            $location = LocationUpdate::query()->create([
                ...$data,
                'user_id' => $request->user()->id,
                'source' => 'field-mobile',
                'received_at' => now(),
            ]);

            $sharingEnabled = (bool) $data['sharing_enabled'];
            $audit->handle(
                $request->user(),
                $location,
                $sharingEnabled ? 'tracking.location_shared' : 'tracking.location_sharing_paused',
                null,
                [
                    'sharing_enabled' => $sharingEnabled,
                    'captured_at' => $location->captured_at?->toIso8601String(),
                ],
            );
            $broadcast->afterCommit();

            return response()->json(['data' => new LocationUpdateResource($location)], 201);
        };

        /** @var JsonResponse */
        return $idempotency->process(
            $request->user(),
            $commandId,
            'location.store',
            null,
            $execute,
            collect($request->validated())->except('command_id')->all(),
        );
    }
}
