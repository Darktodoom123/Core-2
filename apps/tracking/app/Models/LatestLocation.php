<?php

namespace Tracking\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int|null $user_id
 * @property int|null $operational_asset_id
 * @property int|null $dispatch_job_id
 * @property int|null $location_sample_id
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
final class LatestLocation extends Model
{
    protected $table = 'latest_locations';

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'operational_asset_id' => 'integer',
            'dispatch_job_id' => 'integer',
            'location_sample_id' => 'integer',
            'latitude' => 'float',
            'longitude' => 'float',
            'accuracy_metres' => 'float',
            'speed' => 'float',
            'sharing_enabled' => 'boolean',
            'captured_at' => 'immutable_datetime',
            'received_at' => 'immutable_datetime',
        ];
    }

    public static function computeFreshness(?CarbonInterface $timestamp, bool $sharingEnabled): string
    {
        if (! $sharingEnabled || ! $timestamp) {
            return 'offline';
        }

        $secondsAgo = (int) abs(now()->diffInSeconds($timestamp));

        if ($secondsAgo <= 180) {
            return 'fresh';
        }

        if ($secondsAgo < 900) {
            return 'delayed';
        }

        if ($secondsAgo <= 1800) {
            return 'stale';
        }

        return 'offline';
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
            'location_sample_id' => $this->location_sample_id,
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
            'freshness_status' => self::computeFreshness($timestamp, (bool) $this->sharing_enabled),
        ];
    }
}
