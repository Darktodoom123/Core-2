<?php

namespace App\Modules\Dispatch\Planning\Models;

use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $project_phase_id
 * @property int $operational_asset_id
 * @property string $kind
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property string|null $notes
 * @property OperationalAsset|null $asset
 */
class ProjectAllocation extends Model
{
    protected $table = 'dispatch_project_allocations';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<ProjectPhase, $this> */
    public function phase(): BelongsTo
    {
        return $this->belongsTo(ProjectPhase::class, 'project_phase_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id')->withTrashed();
    }
}
