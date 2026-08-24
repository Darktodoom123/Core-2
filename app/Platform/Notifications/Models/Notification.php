<?php

namespace App\Platform\Notifications\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $type
 * @property string $notifiable_type
 * @property int $notifiable_id
 * @property int|null $dispatch_job_id
 * @property string|null $sos_incident_id
 * @property string $status
 * @property array<string, mixed> $data
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property DispatchJob|null $dispatchJob
 */
class Notification extends Model
{
    use HasUuids;

    protected $fillable = [
        'type',
        'notifiable_type',
        'notifiable_id',
        'dispatch_job_id',
        'sos_incident_id',
        'status',
        'data',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    /** @return MorphTo<Model, $this> */
    public function notifiable(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<SosIncident, $this> */
    public function sosIncident(): BelongsTo
    {
        return $this->belongsTo(SosIncident::class, 'sos_incident_id');
    }
}
