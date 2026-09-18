<?php

namespace App\Platform\Notifications\Models;

use App\Platform\Identity\Models\User;
use App\Platform\Identity\Models\UserDeviceToken;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $user_device_token_id
 * @property string|null $ticket_id
 * @property string $event
 * @property string|null $relevance_type
 * @property string|null $relevance_id
 * @property string|null $deduplication_key
 * @property string $status
 * @property string $provider
 * @property string|null $error_code
 * @property string|null $error_message
 * @property Carbon|null $queued_at
 * @property Carbon|null $sent_at
 * @property Carbon|null $delivered_at
 * @property Carbon|null $opened_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User $user
 * @property-read UserDeviceToken|null $deviceToken
 */
class PushDelivery extends Model
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_FAILED = 'failed';

    public const STATUS_OPENED = 'opened';

    protected $fillable = [
        'user_id',
        'user_device_token_id',
        'ticket_id',
        'event',
        'relevance_type',
        'relevance_id',
        'deduplication_key',
        'status',
        'provider',
        'error_code',
        'error_message',
        'queued_at',
        'sent_at',
        'delivered_at',
        'opened_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'queued_at' => 'datetime',
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'opened_at' => 'datetime',
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
     * @return BelongsTo<UserDeviceToken, $this>
     */
    public function deviceToken(): BelongsTo
    {
        return $this->belongsTo(UserDeviceToken::class, 'user_device_token_id');
    }

    /**
     * Scope to find deliveries awaiting receipt verification.
     *
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopePendingReceipt(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACCEPTED)
            ->whereNotNull('ticket_id')
            ->where('sent_at', '<=', now()->subMinutes(10))
            ->where('sent_at', '>=', now()->subHours(24));
    }

    public function markAccepted(string $ticketId): void
    {
        $this->update([
            'status' => self::STATUS_ACCEPTED,
            'ticket_id' => $ticketId,
            'sent_at' => now(),
        ]);
    }

    public function markDelivered(): void
    {
        $this->update([
            'status' => self::STATUS_DELIVERED,
            'delivered_at' => now(),
        ]);
    }

    public function markFailed(?string $errorCode, ?string $errorMessage): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'error_code' => $errorCode,
            'error_message' => $errorMessage,
        ]);
    }

    public function markOpened(): void
    {
        $this->update([
            'status' => self::STATUS_OPENED,
            'opened_at' => now(),
        ]);
    }
}
