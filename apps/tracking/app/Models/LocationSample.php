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
}
