<?php

namespace App\Modules\Dvir\Models;

use App\Modules\Dvir\Enums\DvirCheckStatus;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $dvir_inspection_id
 * @property string|null $external_id
 * @property string $category
 * @property string $label
 * @property DvirCheckStatus $status
 * @property string|null $status_label
 * @property string|null $notes
 * @property int $sort_order
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read DvirInspection $inspection
 */
class DvirInspectionCheck extends Model
{
    protected $table = 'dvir_inspection_checks';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'status' => DvirCheckStatus::class,
            'sort_order' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<DvirInspection, $this>
     */
    public function inspection(): BelongsTo
    {
        return $this->belongsTo(DvirInspection::class, 'dvir_inspection_id');
    }
}
