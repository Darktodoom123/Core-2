<?php

namespace App\Modules\Dispatch\Planning\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $project_phase_id
 * @property int $dispatch_job_id
 * @property int $version
 * @property int|null $confirmed_plan_version
 * @property int|null $requested_by
 * @property list<array{user_id:int, assignment_type:string}>|null $pending_roster
 * @property string|null $reason
 * @property ProjectPhase $phase
 * @property DispatchJob $job
 */
class ProjectShift extends Model
{
    protected $table = 'dispatch_project_shifts';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['pending_roster' => 'array', 'version' => 'integer', 'confirmed_plan_version' => 'integer'];
    }

    /** @return BelongsTo<ProjectPhase, $this> */
    public function phase(): BelongsTo
    {
        return $this->belongsTo(ProjectPhase::class, 'project_phase_id');
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function job(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id')->withTrashed();
    }
}
