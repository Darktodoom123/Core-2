<?php

namespace App\Platform\Audit\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $action
 * @property string|null $reason
 * @property Carbon|null $occurred_at
 */
class AuditEvent extends Model
{
    protected $fillable = ['actor_id', 'subject_type', 'subject_id', 'action', 'before', 'after', 'reason', 'request_id', 'ip_address', 'occurred_at'];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array', 'occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(static function (): never {
            throw new \LogicException('Audit records are immutable and cannot be modified.');
        });

        static::deleting(static function (): never {
            throw new \LogicException('Audit records are immutable and cannot be deleted.');
        });
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
