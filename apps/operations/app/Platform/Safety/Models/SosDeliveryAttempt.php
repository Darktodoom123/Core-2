<?php

namespace App\Platform\Safety\Models;

use App\Platform\Safety\Enums\SosDeliveryAttemptStatus;
use Database\Factories\SosDeliveryAttemptFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class SosDeliveryAttempt extends Model
{
    /** @use HasFactory<SosDeliveryAttemptFactory> */
    use HasFactory;

    protected static function newFactory(): SosDeliveryAttemptFactory
    {
        return SosDeliveryAttemptFactory::new();
    }

    protected $fillable = [
        'sos_incident_id', 'channel', 'target_type', 'target_id', 'attempt_status', 'provider_reference', 'failure_code',
        'attempted_at', 'delivered_at', 'retry_count',
    ];

    protected function casts(): array
    {
        return [
            'attempt_status' => SosDeliveryAttemptStatus::class,
            'attempted_at' => 'datetime',
            'delivered_at' => 'datetime',
            'retry_count' => 'integer',
        ];
    }

    /** @return BelongsTo<SosIncident, $this> */
    public function incident(): BelongsTo
    {
        return $this->belongsTo(SosIncident::class, 'sos_incident_id');
    }
}
