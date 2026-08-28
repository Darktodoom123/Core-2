<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Tracking\Models\LocationUpdate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property DispatchPriority $priority
 * @property DispatchStatus $status
 * @property int $version
 * @property string|null $source_type
 * @property int|null $source_id
 * @property string|null $site
 * @property string|null $site_notes
 * @property float|null $site_latitude
 * @property float|null $site_longitude
 * @property Carbon|null $scheduled_start
 * @property Carbon|null $scheduled_end
 * @property int|null $cancelled_by
 * @property string|null $cancellation_reason
 */
class DispatchJob extends Model
{
    use SoftDeletes;

    protected $fillable = ['service_request_id', 'source_type', 'source_id', 'source_reference', 'reference', 'client', 'title', 'site', 'site_notes', 'site_latitude', 'site_longitude', 'planned_crane_slots', 'scheduled_start', 'scheduled_end', 'priority', 'status', 'requirements', 'created_by', 'activated_by', 'cancelled_by', 'cancellation_reason', 'version'];

    protected function casts(): array
    {
        return [
            'site_latitude' => 'float',
            'site_longitude' => 'float',
            'planned_crane_slots' => 'array',
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'priority' => DispatchPriority::class,
            'status' => DispatchStatus::class,
            'requirements' => 'array',
        ];
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

    /** @return MorphTo<Model, $this> */
    public function source(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'source_type', 'source_id');
    }

    public function sourceType(): ?DispatchSourceType
    {
        return DispatchSourceType::tryFrom((string) $this->source_type);
    }

    /** @return HasOne<DispatchHandoff, $this> */
    public function canonicalHandoff(): HasOne
    {
        return $this->hasOne(DispatchHandoff::class, 'legacy_dispatch_job_id');
    }

    /** @return HasMany<DispatchExecutionAttempt, $this> */
    public function attempts(): HasMany
    {
        return $this->hasMany(DispatchExecutionAttempt::class, 'legacy_dispatch_job_id');
    }

    /** @return HasOne<DispatchExecutionAttempt, $this> */
    public function currentAttempt(): HasOne
    {
        return $this->hasOne(DispatchExecutionAttempt::class, 'legacy_dispatch_job_id')->latestOfMany('attempt_number');
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
        return $this->hasMany(ApprovalRequest::class, 'subject_id')->where('subject_type', $this->getMorphClass());
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

        return $query->whereIn('id', DispatchPersonnelAssignment::query()
            ->open()
            ->where('user_id', $user->id)
            ->select('dispatch_job_id'));
    }
}
