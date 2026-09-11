<?php

namespace App\Platform\Safety\Models;

use App\Platform\Identity\Models\User;
use Database\Factories\SosIncidentRecipientFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property int $user_id */
final class SosIncidentRecipient extends Model
{
    /** @use HasFactory<SosIncidentRecipientFactory> */
    use HasFactory;

    protected static function newFactory(): SosIncidentRecipientFactory
    {
        return SosIncidentRecipientFactory::new();
    }

    protected $fillable = [
        'sos_incident_id', 'user_id', 'role_at_alert', 'resolution_reason', 'notified_at', 'acknowledged_notification_at',
    ];

    protected function casts(): array
    {
        return [
            'notified_at' => 'datetime',
            'acknowledged_notification_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<SosIncident, $this> */
    public function incident(): BelongsTo
    {
        return $this->belongsTo(SosIncident::class, 'sos_incident_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
