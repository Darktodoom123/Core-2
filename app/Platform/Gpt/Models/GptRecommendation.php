<?php

namespace App\Platform\Gpt\Models;

use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $purpose
 * @property string $context_hash
 * @property array<string, mixed>|null $input_references
 * @property array<string, mixed>|null $recommendation
 * @property array<string, mixed>|null $conflicts
 * @property string $model
 * @property GptRecommendationStatus $status
 * @property Carbon|null $decided_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $generated_at
 * @property int|null $latency_ms
 * @property Carbon|null $purge_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class GptRecommendation extends Model
{
    protected $fillable = [
        'subject_type',
        'subject_id',
        'requested_by',
        'purpose',
        'context_hash',
        'input_references',
        'recommendation',
        'conflicts',
        'model',
        'status',
        'decided_by',
        'decided_at',
        'prompt_summary',
        'response_summary',
        'usage',
        'expires_at',
        'cost_usd',
        'error_message',
        'generated_at',
        'latency_ms',
        'purge_at',
    ];

    protected function casts(): array
    {
        return [
            'input_references' => 'array',
            'recommendation' => 'array',
            'conflicts' => 'array',
            'usage' => 'array',
            'decided_at' => 'datetime',
            'expires_at' => 'datetime',
            'generated_at' => 'datetime',
            'purge_at' => 'datetime',
            'latency_ms' => 'integer',
            'cost_usd' => 'decimal:4',
            'status' => GptRecommendationStatus::class,
        ];
    }

    /** @return MorphTo<Model, $this> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<User, $this> */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return BelongsTo<User, $this> */
    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isPending(): bool
    {
        return in_array($this->status, [GptRecommendationStatus::Draft, GptRecommendationStatus::Processing, GptRecommendationStatus::PendingReview], true);
    }

    public function isAccepted(): bool
    {
        return $this->status === GptRecommendationStatus::Accepted;
    }

    public function isRejected(): bool
    {
        return $this->status === GptRecommendationStatus::Rejected;
    }

    public function isStale(string $currentHash): bool
    {
        return $this->isExpired() || $this->context_hash !== $currentHash;
    }
}
