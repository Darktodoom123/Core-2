<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationUpdate extends Model
{
    protected $fillable = ['user_id', 'operational_asset_id', 'latitude', 'longitude', 'accuracy_metres', 'source', 'sharing_enabled', 'captured_at', 'received_at'];

    protected function casts(): array
    {
        return ['sharing_enabled' => 'boolean', 'captured_at' => 'datetime', 'received_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
