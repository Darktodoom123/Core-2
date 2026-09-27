<?php

namespace App\Modules\Assignment\Http\Resources\V1;

use App\Shared\Assets\Models\UnitLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin UnitLink
 */
final class UnitLinkResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'operational_asset_id' => $this->operational_asset_id,
            'asset_code' => $this->asset->code,
            'asset_name' => $this->asset->name,
            'dispatch_job_id' => $this->dispatch_job_id,
            'linked_at' => $this->linked_at->toIso8601String(),
            'released_at' => $this->released_at?->toIso8601String(),
            'release_reason' => $this->release_reason?->value,
        ];
    }
}
