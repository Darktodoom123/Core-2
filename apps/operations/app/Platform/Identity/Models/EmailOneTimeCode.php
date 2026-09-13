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
 * @property string $challenge_id
 * @property string $purpose
 * @property string $code_hash
 * @property int $attempts
 * @property int $max_attempts
 * @property int $resend_count
 * @property Carbon $expires_at
 * @property Carbon|null $verified_at
 * @property array<string, mixed>|null $metadata
 * @property string|null $ip_address
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 */
#[Fillable([
    'user_id',
    'challenge_id',
    'purpose',
    'code_hash',
    'attempts',
    'max_attempts',
    'resend_count',
    'expires_at',
    'verified_at',
    'metadata',
    'ip_address',
])]
#[Hidden(['code_hash'])]
class EmailOneTimeCode extends Model
{
    public const PURPOSE_LOGIN = 'login';

    public const PURPOSE_ENABLE_OTP = 'enable_email_otp';

    public const PURPOSE_DISABLE_OTP = 'disable_email_otp';

    public const PURPOSE_EMAIL_CHANGE = 'email_change';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'max_attempts' => 'integer',
            'metadata' => 'array',
            'resend_count' => 'integer',
            'verified_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    public function isExhausted(): bool
    {
        return $this->attempts >= $this->max_attempts;
    }

    public function isValid(): bool
    {
        return ! $this->isExpired() && ! $this->isVerified() && ! $this->isExhausted();
    }

    /**
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->whereNull('verified_at')
            ->where('expires_at', '>', now())
            ->whereColumn('attempts', '<', 'max_attempts');
    }
}
