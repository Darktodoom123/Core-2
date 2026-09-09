<?php

namespace App\Platform\Tracking\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Tracking\Actions\BroadcastTrackingWorkspaceUpdate;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingConflictException;
use App\Platform\Tracking\Http\Requests\StoreLocationUpdateRequest;
use App\Platform\Tracking\Http\Resources\V1\LocationUpdateResource;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Illuminate\Http\JsonResponse;

final class LocationController extends Controller
{
    public function store(
        StoreLocationUpdateRequest $request,
        IdempotentCommandService $idempotency,
        RecordAuditEvent $audit,
        BroadcastTrackingWorkspaceUpdate $broadcast,
        TrackingClientInterface $trackingClient,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $audit, $broadcast, $trackingClient, $commandId): JsonResponse {
            $data = $request->validated();
            unset($data['command_id']);

            $sample = LocationSampleDto::fromArray([
                'command_id' => $commandId,
                'user_id' => $request->user()->id,
                'operational_asset_id' => $data['operational_asset_id'] ?? null,
                'dispatch_job_id' => $data['dispatch_job_id'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'accuracy_metres' => $data['accuracy_metres'] ?? null,
                'speed' => $data['speed'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'source' => 'field-mobile',
                'sharing_enabled' => (bool) ($data['sharing_enabled'] ?? true),
                'captured_at' => $data['captured_at'] ?? now(),
                'received_at' => now(),
            ]);

            try {
                $latest = $trackingClient->ingestLocation($sample);
            } catch (TrackingConflictException $e) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'error' => 'conflict',
                ], 409);
            }

            if ($trackingClient instanceof FakeTrackingClient) {
                LocationUpdate::query()->create([
                    ...$data,
                    'user_id' => $request->user()->id,
                    'source' => 'field-mobile',
                    'received_at' => now(),
                ]);
            }

            $sharingEnabled = (bool) $data['sharing_enabled'];
            $audit->handle(
                $request->user(),
                $request->user(),
                $sharingEnabled ? 'tracking.location_shared' : 'tracking.location_sharing_paused',
                null,
                [
                    'sharing_enabled' => $sharingEnabled,
                    'captured_at' => $latest->capturedAt?->toIso8601String(),
                ],
            );
            $broadcast->afterCommit();

            return response()->json(['data' => new LocationUpdateResource($latest)], 201);
        };

        /** @var JsonResponse */
        return $idempotency->process(
            $request->user(),
            $commandId,
            'location.store',
            null,
            $execute,
            collect($request->validated())->except('command_id')->all(),
            wrapInTransaction: false,
        );
    }
}
