<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchReconciliationRunStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DispatchReconciliationRun extends Model
{
    protected $fillable = [
        'name', 'workspace_key', 'status', 'dry_run', 'batch_limit', 'checkpoint', 'scanned_count',
        'created_count', 'updated_count', 'finding_count', 'started_at', 'completed_at', 'last_error',
    ];

    protected function casts(): array
    {
        return [
            'status' => DispatchReconciliationRunStatus::class,
            'dry_run' => 'boolean',
            'batch_limit' => 'integer',
            'checkpoint' => 'array',
            'scanned_count' => 'integer',
            'created_count' => 'integer',
            'updated_count' => 'integer',
            'finding_count' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return HasMany<DispatchReconciliationFinding, $this> */
    public function findings(): HasMany
    {
        return $this->hasMany(DispatchReconciliationFinding::class, 'run_id');
    }
}
