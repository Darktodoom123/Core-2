<?php

namespace App\Models;

use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\PermissionName;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property DispatchPriority $priority
 * @property DispatchStatus $status
 * @property int $version
 * @property Carbon|null $scheduled_start
 * @property Carbon|null $scheduled_end
 */
class DispatchJob extends Model
{
    use SoftDeletes;

    protected $fillable = ['service_request_id', 'reference', 'client', 'title', 'site', 'site_notes', 'scheduled_start', 'scheduled_end', 'priority', 'status', 'requirements', 'created_by', 'version'];

    protected function casts(): array
    {
        return ['scheduled_start' => 'datetime', 'scheduled_end' => 'datetime', 'priority' => DispatchPriority::class, 'status' => DispatchStatus::class, 'requirements' => 'array'];
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<ServiceRequest, $this> */
    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    /** @return HasMany<DispatchPersonnelAssignment, $this> */
    public function personnelAssignments(): HasMany
    {
        return $this->hasMany(DispatchPersonnelAssignment::class);
    }

    /** @return HasMany<DispatchAssetAssignment, $this> */
    public function assetAssignments(): HasMany
    {
        return $this->hasMany(DispatchAssetAssignment::class);
    }

    /** @return HasMany<ApprovalRequest, $this> */
    public function approvals(): HasMany
    {
        return $this->hasMany(ApprovalRequest::class, 'subject_id')->where('subject_type', self::class);
    }

    /** @return HasMany<JobReport, $this> */
    public function reports(): HasMany
    {
        return $this->hasMany(JobReport::class);
    }

    /** @return HasMany<LocationUpdate, $this> */
    public function locationUpdates(): HasMany
    {
        return $this->hasMany(LocationUpdate::class);
    }

    /**
     * @param  Builder<DispatchJob>  $query
     * @return Builder<DispatchJob>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can(PermissionName::DispatchViewAll->value)) {
            return $query;
        }

        return $query->whereHas('personnelAssignments', fn (Builder $assignment): Builder => $assignment
            ->where('user_id', $user->id)->whereNull('active_until'));
    }
}
