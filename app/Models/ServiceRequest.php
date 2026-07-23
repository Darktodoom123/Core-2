<?php

namespace App\Models;

use App\Enums\DispatchPriority;
use App\Enums\ServiceRequestStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property DispatchPriority $priority
 * @property ServiceRequestStatus $status
 * @property Carbon|null $scheduled_date
 * @property array<int, string>|null $requirements
 */
class ServiceRequest extends Model
{
    use SoftDeletes;

    protected $fillable = ['reference', 'client_id', 'created_by', 'project_name', 'service_type', 'location', 'site_notes', 'scheduled_date', 'priority', 'status', 'requirements'];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'datetime',
            'priority' => DispatchPriority::class,
            'status' => ServiceRequestStatus::class,
            'requirements' => 'array',
        ];
    }

    /** @return BelongsTo<Client, $this> */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<DispatchJob, $this> */
    public function dispatchJobs(): HasMany
    {
        return $this->hasMany(DispatchJob::class);
    }
}
