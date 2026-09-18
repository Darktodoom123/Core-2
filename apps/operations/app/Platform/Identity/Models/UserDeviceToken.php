<?php

namespace App\Platform\Identity\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property string $installation_id
 * @property string $token
 * @property string $platform
 * @property string $provider
 * @property string|null $app_version
 * @property bool $is_active
 * @property Carbon|null $last_registered_at
 * @property Carbon|null $last_used_at
 * @property Carbon|null $revoked_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable([
    'user_id',
    'installation_id',
    'token',
    'platform',
    'provider',
    'app_version',
    'is_active',
    'last_registered_at',
    'last_used_at',
    'revoked_at',
])]
#[Hidden(['token'])]
class UserDeviceToken extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'last_registered_at' => 'datetime',
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->whereNull('revoked_at');
    }

    public function revoke(): void
    {
        $this->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);
    }
}
