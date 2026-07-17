<?php

namespace App\Models;

use App\Enums\FuelRequestStatus;
use App\Enums\PermissionName;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $requester_id
 * @property FuelRequestStatus $status
 */
class FuelRequest extends Model
{
    protected $fillable = ['reference', 'requester_id', 'dispatch_job_id', 'operational_asset_id', 'quantity_litres', 'fuel_type', 'purpose', 'status', 'reviewed_by', 'approved_by', 'verified_by', 'reviewed_at', 'approved_at', 'verified_at', 'decision_reason'];

    protected function casts(): array
    {
        return ['status' => FuelRequestStatus::class, 'quantity_litres' => 'decimal:2', 'reviewed_at' => 'datetime', 'approved_at' => 'datetime', 'verified_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function job(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return HasMany<FuelLog, $this> */
    public function logs(): HasMany
    {
        return $this->hasMany(FuelLog::class);
    }

    /**
     * @param  Builder<FuelRequest>  $query
     * @return Builder<FuelRequest>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $user->can(PermissionName::FuelViewAll->value) ? $query : $query->where('requester_id', $user->id);
    }
}
