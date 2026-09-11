<?php

namespace App\Modules\Dispatch\Planning\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $project_plan_id
 * @property string $name
 * @property string $kind
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property array<string, int> $coverage
 * @property ProjectPlan $plan
 * @property Collection<int, ProjectAllocation> $allocations
 * @property Collection<int, ProjectShift> $shifts
 */
class ProjectPhase extends Model
{
    protected $table = 'dispatch_project_phases';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'coverage' => 'array'];
    }

    /** @return BelongsTo<ProjectPlan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(ProjectPlan::class, 'project_plan_id');
    }

    /** @return HasMany<ProjectAllocation, $this> */
    public function allocations(): HasMany
    {
        return $this->hasMany(ProjectAllocation::class)->orderBy('starts_at');
    }

    /** @return HasMany<ProjectShift, $this> */
    public function shifts(): HasMany
    {
        return $this->hasMany(ProjectShift::class);
    }
}
