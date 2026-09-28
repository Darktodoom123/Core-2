<?php

namespace App\Platform\Geocoding\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $coordinate_key
 * @property string $latitude
 * @property string $longitude
 * @property string|null $primary_name
 * @property string|null $secondary_name
 * @property string|null $provider
 * @property Carbon|null $resolved_at
 * @property Carbon|null $failed_at
 */
final class GeocodedPlace extends Model
{
    protected $fillable = [
        'coordinate_key', 'latitude', 'longitude', 'primary_name',
        'secondary_name', 'provider', 'resolved_at', 'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
