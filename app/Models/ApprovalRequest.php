<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property string $kind
 * @property int $requested_by
 * @property ApprovalStatus $status
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
}
