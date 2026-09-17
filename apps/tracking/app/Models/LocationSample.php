<?php

namespace Tracking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $operational_asset_id
 * @property int|null $dispatch_job_id
 * @property float|null $latitude
 * @property float|null $longitude
 * @property float|null $accuracy_metres
 * @property float|null $speed
 * @property string|null $remarks
 * @property string $source
 * @property bool $sharing_enabled
 * @property string|null $command_id
 * @property CarbonImmutable|null $captured_at
 * @property CarbonImmutable|null $received_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
final class LocationSample extends Model
{
    protected $table = 'location_samples';

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'operational_asset_id' => 'integer',
            'dispatch_job_id' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy_metres' => 'float',
            'speed' => 'float',
            'sharing_enabled' => 'boolean',
            'captured_at' => 'immutable_datetime',
            'received_at' => 'immutable_datetime',
        ];
    }

    /** @return array<string, mixed> */
    public function toDtoArray(): array
    {
        $timestamp = $this->received_at ?? $this->captured_at;

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'operational_asset_id' => $this->operational_asset_id,
            'dispatch_job_id' => $this->dispatch_job_id,
            'location_sample_id' => $this->id,
            'latitude' => $this->sharing_enabled && $this->latitude !== null ? (float) $this->latitude : null,
            'longitude' => $this->sharing_enabled && $this->longitude !== null ? (float) $this->longitude : null,
            'accuracy_metres' => $this->sharing_enabled && $this->accuracy_metres !== null ? (float) $this->accuracy_metres : null,
            'speed' => $this->sharing_enabled && $this->speed !== null ? (float) $this->speed : null,
            'remarks' => $this->remarks,
            'source' => $this->source,
            'sharing_enabled' => (bool) $this->sharing_enabled,
            'command_id' => $this->command_id,
            'captured_at' => $this->captured_at?->toIso8601String(),
            'received_at' => $this->received_at?->toIso8601String(),
            'freshness_status' => LatestLocation::computeFreshness($timestamp, (bool) $this->sharing_enabled),
        ];
    }
}
