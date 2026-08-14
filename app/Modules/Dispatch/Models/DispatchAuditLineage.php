<?php

namespace App\Modules\Dispatch\Models;

use App\Platform\Audit\Models\AuditEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchAuditLineage extends Model
{
    protected $table = 'dispatch_audit_lineage';

    public const UPDATED_AT = null;

    protected $fillable = [
        'audit_event_id', 'workspace_key', 'handoff_id', 'attempt_id', 'plan_version_id', 'offer_id',
        'idempotency_key_id', 'lineage_type', 'legacy_subject_type', 'legacy_subject_id', 'created_at',
    ];

    protected function casts(): array
    {
        return ['legacy_subject_id' => 'integer', 'created_at' => 'datetime'];
    }

    /** @return BelongsTo<AuditEvent, $this> */
    public function auditEvent(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }

    /** @return BelongsTo<DispatchHandoff, $this> */
    public function handoff(): BelongsTo
    {
        return $this->belongsTo(DispatchHandoff::class, 'handoff_id');
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'attempt_id');
    }

    /** @return BelongsTo<DispatchPlanVersion, $this> */
    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(DispatchPlanVersion::class, 'plan_version_id');
    }

    /** @return BelongsTo<DispatchAssignmentOffer, $this> */
    public function offer(): BelongsTo
    {
        return $this->belongsTo(DispatchAssignmentOffer::class, 'offer_id');
    }

    /** @return BelongsTo<DispatchIdempotencyKey, $this> */
    public function idempotencyKey(): BelongsTo
    {
        return $this->belongsTo(DispatchIdempotencyKey::class, 'idempotency_key_id');
    }
}
