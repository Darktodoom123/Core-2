<?php

namespace App\Platform\Tracking\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingConflictException;
use App\Platform\Tracking\Exceptions\TrackingServiceUnavailableException;
use App\Platform\Tracking\Http\Resources\V1\LocationUpdateResource;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Illuminate\Http\JsonResponse;

/**
 * Stores one validated location sample under its command id. A resend of
 * the same command id is answered from the record instead of stored twice.
 */
final class RecordLocationSample
{
    public function __construct(
        private readonly IdempotentCommandService $idempotency,
        private readonly RecordAuditEvent $audit,
        private readonly BroadcastTrackingWorkspaceUpdate $broadcast,
        private readonly TrackingClientInterface $trackingClient,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated sample, without command_id
     * @param  bool  $broadcast  false when the caller refreshes dispatch once for many samples
     */
    public function handle(User $user, string $commandId, array $data, bool $broadcast = true): JsonResponse
    {
        /** @var JsonResponse */
        return $this->idempotency->process(
            $user,
            $commandId,
            'location.store',
            null,
            fn (): JsonResponse => $this->store($user, $commandId, $data, $broadcast),
            $data,
            wrapInTransaction: false,
        );
    }

    /** @param  array<string, mixed>  $data */
    private function store(User $user, string $commandId, array $data, bool $broadcast): JsonResponse
    {
        $sample = LocationSampleDto::fromArray([
            'command_id' => $commandId,
            'user_id' => $user->id,
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
            $latest = $this->trackingClient->ingestLocation($sample);
        } catch (TrackingConflictException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error' => 'conflict',
            ], 409);
        } catch (TrackingServiceUnavailableException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error' => 'service_unavailable',
            ], 503, ['Retry-After' => '5']);
        }

        if ($this->trackingClient instanceof FakeTrackingClient) {
            LocationUpdate::query()->create([
                ...$data,
                'user_id' => $user->id,
                'source' => 'field-mobile',
                'received_at' => now(),
            ]);
        }

        $sharingEnabled = (bool) $data['sharing_enabled'];
        $this->audit->handle(
            $user,
            $user,
            $sharingEnabled ? 'tracking.location_shared' : 'tracking.location_sharing_paused',
            null,
            [
                'sharing_enabled' => $sharingEnabled,
                'captured_at' => $latest->capturedAt?->toIso8601String(),
            ],
        );

        if ($broadcast) {
            $this->broadcast->afterCommit();
        }

        if ($latest->isQueued) {
            return response()->json([
                'message' => 'Telemetry sample queued for ingestion.',
                'data' => new LocationUpdateResource($latest),
            ], 202);
        }

        return response()->json(['data' => new LocationUpdateResource($latest)], 201);
    }
}
