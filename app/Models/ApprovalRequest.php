<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $kind
 * @property int $requested_by
 * @property int|null $decided_by
 * @property array<string, mixed>|null $requested_changes
 * @property ApprovalStatus $status
 * @property string|null $reason
 * @property Carbon|null $decided_at
 */
class ApprovalRequest extends Model
{
    protected $fillable = ['subject_type', 'subject_id', 'kind', 'requested_changes', 'status', 'requested_by', 'decided_by', 'reason', 'decided_at'];

    protected function casts(): array
    {
        return ['requested_changes' => 'array', 'status' => ApprovalStatus::class, 'decided_at' => 'datetime'];
    }

    /** @return MorphTo<Model, $this> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
