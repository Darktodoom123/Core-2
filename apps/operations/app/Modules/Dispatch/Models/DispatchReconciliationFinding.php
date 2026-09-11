<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchReconciliationFindingSeverity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchReconciliationFinding extends Model
{
    protected $fillable = [
        'run_id', 'workspace_key', 'entity_type', 'entity_id', 'code', 'severity', 'details', 'fingerprint', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'entity_id' => 'integer',
            'severity' => DispatchReconciliationFindingSeverity::class,
            'details' => 'array',
            'resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchReconciliationRun, $this> */
    public function run(): BelongsTo
    {
        return $this->belongsTo(DispatchReconciliationRun::class, 'run_id');
    }
}
