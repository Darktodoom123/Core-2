<?php

namespace App\Platform\Reporting\Models;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property int $user_id
 * @property ReportExportType $export_type
 * @property string $format
 * @property ReportExportStatus $status
 * @property array<string, mixed>|null $filters
 * @property string|null $file_path
 * @property int|null $file_size_bytes
 * @property int|null $row_count
 * @property string|null $error_message
 * @property Carbon|null $expires_at
 * @property Carbon|null $started_at
 * @property Carbon|null $completed_at
 * @property User $user
 */
class ReportExport extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'export_type',
        'format',
        'status',
        'filters',
        'file_path',
        'file_size_bytes',
        'row_count',
        'error_message',
        'expires_at',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'export_type' => ReportExportType::class,
            'status' => ReportExportStatus::class,
            'filters' => 'array',
            'file_size_bytes' => 'integer',
            'row_count' => 'integer',
            'expires_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function isExpired(): bool
    {
        return $this->status === ReportExportStatus::Expired
            || ($this->expires_at !== null && $this->expires_at->isPast());
    }

    public function isDownloadable(): bool
    {
        return $this->status === ReportExportStatus::Completed
            && ! $this::isExpired()
            && $this->file_path !== null;
    }

    /**
     * @param  Builder<ReportExport>  $query
     * @return Builder<ReportExport>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can(PermissionName::ReportsExport->value) || $user->can(PermissionName::ReportsViewAll->value)) {
            return $query;
        }

        return $query->where('user_id', $user->id);
    }
}
