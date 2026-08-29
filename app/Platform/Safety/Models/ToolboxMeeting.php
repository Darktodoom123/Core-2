<?php

namespace App\Platform\Safety\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $project_site
 * @property string $topic_id
 * @property string $topic_title
 * @property string $topic_category
 * @property int $conductor_id
 * @property string $conductor_role
 * @property array<string> $attendee_ids
 * @property int $attendee_count
 * @property string|null $photo_evidence_url
 * @property Carbon|null $photo_timestamp
 * @property string|null $notes
 * @property int|null $safety_officer_id
 * @property Carbon|null $safety_officer_signed_at
 * @property string|null $audit_hash
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class ToolboxMeeting extends Model
{
    protected $table = 'toolbox_meetings';

    protected $fillable = [
        'project_site',
        'topic_id',
        'topic_title',
        'topic_category',
        'conductor_id',
        'conductor_role',
        'attendee_ids',
        'attendee_count',
        'photo_evidence_url',
        'photo_timestamp',
        'notes',
        'safety_officer_id',
        'safety_officer_signed_at',
        'audit_hash',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'attendee_ids' => 'array',
            'attendee_count' => 'integer',
            'photo_timestamp' => 'datetime',
            'safety_officer_signed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function conductor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'conductor_id');
    }

    /** @return BelongsTo<User, $this> */
    public function safetyOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'safety_officer_id');
    }
}
