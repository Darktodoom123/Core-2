<?php

namespace App\Modules\Rental\Models;

use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $rental_reservation_id
 * @property int|null $dispatch_job_id
 * @property int|null $submitted_by
 * @property string $handover_type
 * @property float $hour_meter
 * @property int $fuel_percent
 * @property string $condition_assessment
 * @property string|null $condition_notes
 * @property bool $damage_noted
 * @property string|null $damage_notes
 * @property array<string>|null $photos
 * @property string|null $signature_path
 * @property string $signee_name
 * @property string $signee_role
 * @property Carbon|null $submitted_at
 * @property-read string|null $signature_url
 * @property-read User|null $submitter
 */
class RentalHandoverEvidence extends Model
{
    protected $table = 'rental_handover_evidences';

    protected $fillable = [
        'workspace_key',
        'rental_reservation_id',
        'dispatch_job_id',
        'dispatch_execution_attempt_id',
        'operational_asset_id',
        'submitted_by',
        'handover_type',
        'hour_meter',
        'fuel_percent',
        'condition_assessment',
        'condition_notes',
        'damage_noted',
        'damage_notes',
        'photos',
        'signature_path',
        'signee_name',
        'signee_role',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'hour_meter' => 'float',
            'fuel_percent' => 'integer',
            'damage_noted' => 'boolean',
            'photos' => 'array',
            'submitted_at' => 'datetime',
            'dispatch_job_id' => 'integer',
            'dispatch_execution_attempt_id' => 'integer',
            'operational_asset_id' => 'integer',
        ];
    }

    /** @return BelongsTo<RentalReservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(RentalReservation::class, 'rental_reservation_id');
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'dispatch_execution_attempt_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<User, $this> */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function getSignatureUrlAttribute(): ?string
    {
        if (! $this->signature_path) {
            return null;
        }

        return Storage::disk(config('filesystems.default', 'public'))->url($this->signature_path);
    }

    /** @return array<string, mixed> */
    public function toViewModel(): array
    {
        return [
            'id' => (int) $this->id,
            'workspace_key' => $this->workspace_key ?? 'operations',
            'rental_reservation_id' => (int) $this->rental_reservation_id,
            'dispatch_job_id' => $this->dispatch_job_id ? (int) $this->dispatch_job_id : null,
            'dispatch_execution_attempt_id' => $this->dispatch_execution_attempt_id ? (int) $this->dispatch_execution_attempt_id : null,
            'operational_asset_id' => $this->operational_asset_id ? (int) $this->operational_asset_id : null,
            'handover_type' => $this->handover_type,
            'hour_meter' => (float) $this->hour_meter,
            'fuel_percent' => (int) $this->fuel_percent,
            'condition_assessment' => $this->condition_assessment,
            'condition_notes' => $this->condition_notes,
            'damage_noted' => (bool) $this->damage_noted,
            'damage_notes' => $this->damage_notes,
            'photos' => $this->photos ?? [],
            'signature_path' => $this->signature_path,
            'signature_url' => $this->signature_url,
            'signee_name' => $this->signee_name,
            'signee_role' => $this->signee_role,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'submitted_by' => $this->submitter ? [
                'id' => (int) $this->submitter->id,
                'name' => $this->submitter->name,
            ] : null,
            'asset' => $this->asset ? [
                'id' => (int) $this->asset->id,
                'code' => $this->asset->code,
                'name' => $this->asset->name,
            ] : null,
        ];
    }
}
