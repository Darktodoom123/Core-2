<?php

namespace App\Platform\Safety\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $notice_number
 * @property string $project_site
 * @property int $safety_officer_id
 * @property string $dole_regulation_reference
 * @property string $reason
 * @property array<int>|null $affected_asset_ids
 * @property string $affected_area
 * @property bool $is_active
 * @property int|null $acknowledged_by
 * @property Carbon|null $acknowledged_at
 * @property int|null $lifted_by
 * @property Carbon|null $lifted_at
 * @property string|null $lift_reason
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class WorkStoppageNotice extends Model
{
    protected $table = 'work_stoppage_notices';

    protected $fillable = [
        'notice_number',
        'project_site',
        'safety_officer_id',
        'dole_regulation_reference',
        'reason',
        'affected_asset_ids',
        'affected_area',
        'is_active',
        'acknowledged_by',
        'acknowledged_at',
        'lifted_by',
        'lifted_at',
        'lift_reason',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'affected_asset_ids' => 'array',
            'is_active' => 'boolean',
            'acknowledged_at' => 'datetime',
            'lifted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function safetyOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'safety_officer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function acknowledgedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    /** @return BelongsTo<User, $this> */
    public function liftedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lifted_by');
    }
}
