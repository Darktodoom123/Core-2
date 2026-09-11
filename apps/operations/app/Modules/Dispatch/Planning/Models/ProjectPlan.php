<?php

namespace App\Modules\Dispatch\Planning\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $version
 * @property int|null $approved_version
 * @property int $created_by
 * @property int|null $submitted_by
 * @property int|null $approved_by
 * @property string $name
 * @property string $source_reference
 * @property string $client
 * @property string $site
 * @property string $status
 * @property Collection<int, ProjectPhase> $phases
 */
class ProjectPlan extends Model
{
    protected $table = 'dispatch_project_plans';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['version' => 'integer', 'approved_version' => 'integer', 'approved_at' => 'datetime'];
    }

    /** @return HasMany<ProjectPhase, $this> */
    public function phases(): HasMany
    {
        return $this->hasMany(ProjectPhase::class)->orderBy('starts_at')->orderBy('id');
    }
}
