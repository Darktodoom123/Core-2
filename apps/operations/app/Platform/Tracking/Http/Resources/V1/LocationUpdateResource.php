<?php

namespace App\Platform\Tracking\Http\Resources\V1;

use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Models\LocationUpdate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin LocationUpdate */
final class LocationUpdateResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        if ($this->resource instanceof LatestLocationDto) {
            $payload = [
                'id' => $this->resource->id,
                'user_id' => $this->resource->userId,
                'dispatch_job_id' => $this->resource->dispatchJobId,
                'operational_asset_id' => $this->resource->operationalAssetId,
                'latitude' => $this->resource->latitude,
                'longitude' => $this->resource->longitude,
                'accuracy_metres' => $this->resource->accuracyMetres,
                'sharing_enabled' => $this->resource->sharingEnabled,
                'captured_at' => $this->resource->capturedAt?->toIso8601String(),
                'received_at' => $this->resource->receivedAt?->toIso8601String(),
                'remarks' => $this->resource->remarks,
            ];

            if ($this->resource->isQueued) {
                $payload['status'] = 'queued';
                if ($this->resource->streamId !== null) {
                    $payload['stream_id'] = $this->resource->streamId;
                }
            }

            return $payload;
        }

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'dispatch_job_id' => $this->dispatch_job_id,
            'operational_asset_id' => $this->operational_asset_id,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'accuracy_metres' => $this->accuracy_metres,
            'sharing_enabled' => $this->sharing_enabled,
            'captured_at' => $this->captured_at?->toIso8601String(),
            'received_at' => $this->received_at?->toIso8601String(),
            'remarks' => $this->remarks,
        ];
    }
}
