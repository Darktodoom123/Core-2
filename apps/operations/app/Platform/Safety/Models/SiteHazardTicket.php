<?php

namespace App\Platform\Safety\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $ticket_code
 * @property string $project_site
 * @property int $reporter_id
 * @property string $category
 * @property string $severity
 * @property string $description
 * @property string $location_detail
 * @property string|null $photo_evidence_url
 * @property string $corrective_action_required
 * @property string $status
 * @property bool $work_stoppage_issued
 * @property int|null $rectified_by
 * @property Carbon|null $rectified_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class SiteHazardTicket extends Model
{
    protected $table = 'site_hazard_tickets';

    protected $fillable = [
        'ticket_code',
        'project_site',
        'reporter_id',
        'category',
        'severity',
        'description',
        'location_detail',
        'photo_evidence_url',
        'corrective_action_required',
        'status',
        'work_stoppage_issued',
        'rectified_by',
        'rectified_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'work_stoppage_issued' => 'boolean',
            'rectified_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    /** @return BelongsTo<User, $this> */
    public function rectifiedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rectified_by');
    }
}
