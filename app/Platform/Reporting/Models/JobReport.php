<?php

namespace App\Platform\Reporting\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $dispatch_job_id
 * @property int $author_id
 * @property JobReportStatus $status
 * @property Carbon|null $started_at
 * @property Carbon|null $ended_at
 * @property Carbon|null $submitted_at
 * @property string $work_summary
 * @property string|null $remarks
 * @property DispatchJob $job
 * @property User|null $author
 */
class JobReport extends Model
{
    protected $fillable = ['dispatch_job_id', 'author_id', 'started_at', 'ended_at', 'work_summary', 'remarks', 'status', 'submitted_at'];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'submitted_at' => 'datetime',
            'status' => JobReportStatus::class,
        ];
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function job(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** @return MorphMany<Attachment, $this> */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'owner');
    }

    /**
     * @param  Builder<JobReport>  $query
     * @return Builder<JobReport>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can(PermissionName::ReportsViewAll->value) || $user->can(PermissionName::ReportsViewDispatch->value)) {
            return $query;
        }

        return $query->where('author_id', $user->id);
    }
}
