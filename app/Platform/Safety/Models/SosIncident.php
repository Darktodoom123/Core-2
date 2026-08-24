<?php

namespace App\Platform\Safety\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Factories\SosIncidentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $command_id
 * @property int $reporter_id
 * @property int|null $dispatch_job_id
 * @property int|null $operational_asset_id
 * @property SosIncidentCategory $category
 * @property SosIncidentStatus $status
 * @property Carbon $device_activated_at
 * @property Carbon $received_at
 * @property Carbon $escalation_due_at
 * @property Carbon|null $acknowledged_at
 * @property Carbon|null $escalated_at
 * @property Carbon|null $resolved_at
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $location_captured_at
 * @property Carbon|null $location_pruned_at
 * @property int $version
 */
final class SosIncident extends Model
{
    /** @use HasFactory<SosIncidentFactory> */
    use HasFactory, HasUuids;

    protected $table = 'sos_incidents';

    protected static function newFactory(): SosIncidentFactory
    {
        return SosIncidentFactory::new();
    }

    protected $fillable = [
        'id', 'command_id', 'reporter_id', 'dispatch_job_id', 'operational_asset_id', 'category', 'status', 'worker_note',
        'device_activated_at', 'received_at', 'escalation_due_at', 'acknowledged_by', 'acknowledged_at', 'escalated_at',
        'resolved_by', 'resolved_at', 'resolution_code', 'resolution_notes', 'cancelled_by', 'cancelled_at',
        'cancellation_reason', 'latitude', 'longitude', 'accuracy_metres', 'location_captured_at', 'location_pruned_at', 'version',
    ];

    public function getIncrementing(): bool
    {
        return false;
    }

    protected function casts(): array
    {
        return [
            'category' => SosIncidentCategory::class,
            'status' => SosIncidentStatus::class,
            'device_activated_at' => 'datetime',
            'received_at' => 'datetime',
            'escalation_due_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'escalated_at' => 'datetime',
            'resolved_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'location_captured_at' => 'datetime',
            'location_pruned_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'accuracy_metres' => 'decimal:2',
            'version' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function operationalAsset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<User, $this> */
    public function acknowledgedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }

    /** @return BelongsTo<User, $this> */
    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    /** @return BelongsTo<User, $this> */
    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /** @return HasMany<SosIncidentRecipient, $this> */
    public function recipients(): HasMany
    {
        return $this->hasMany(SosIncidentRecipient::class);
    }

    /** @return HasMany<SosDeliveryAttempt, $this> */
    public function deliveryAttempts(): HasMany
    {
        return $this->hasMany(SosDeliveryAttempt::class);
    }

    /** @param Builder<SosIncident> $query
     * @return Builder<SosIncident>
     */
    public function scopeUnresolved(Builder $query): Builder
    {
        return $query->whereIn('status', [
            SosIncidentStatus::Active->value,
            SosIncidentStatus::Escalated->value,
            SosIncidentStatus::Acknowledged->value,
        ]);
    }

    /** @param Builder<SosIncident> $query
     * @return Builder<SosIncident>
     */
    public function scopeAwaitingEscalation(Builder $query): Builder
    {
        return $query->where('status', SosIncidentStatus::Active->value)
            ->where('escalation_due_at', '<=', now());
    }

    /** @return array<string, mixed> */
    public function auditSnapshot(): array
    {
        return [
            'status' => $this->status->value,
            'category' => $this->category->value,
            'dispatch_job_id' => $this->dispatch_job_id,
            'operational_asset_id' => $this->operational_asset_id,
            'has_location' => $this->location_captured_at !== null && $this->location_pruned_at === null,
            'version' => $this->version,
        ];
    }
}
