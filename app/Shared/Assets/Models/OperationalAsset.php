<?php

namespace App\Shared\Assets\Models;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $code
 * @property string $kind
 * @property AssetStatus $status
 */
class OperationalAsset extends Model
{
    use SoftDeletes;

    protected $fillable = ['code', 'name', 'kind', 'subtype', 'status', 'location', 'specifications', 'registration_number', 'manufacturer', 'model', 'rated_capacity', 'capacity_unit', 'meter_type', 'meter_value'];

    protected function casts(): array
    {
        return ['status' => AssetStatus::class, 'specifications' => 'array', 'rated_capacity' => 'decimal:2', 'meter_value' => 'decimal:2'];
    }

    /** @return HasMany<DispatchAssetAssignment, $this> */
    public function assignments(): HasMany
    {
        return $this->hasMany(DispatchAssetAssignment::class);
    }

    /** @return HasMany<MaintenanceWorkOrder, $this> */
    public function maintenanceWorkOrders(): HasMany
    {
        return $this->hasMany(MaintenanceWorkOrder::class);
    }

    /** @return HasMany<Inspection, $this> */
    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class);
    }

    /**
     * @param  Builder<OperationalAsset>  $query
     * @return Builder<OperationalAsset>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can(PermissionName::FleetViewAll->value) || $user->can(PermissionName::EquipmentViewAll->value)) {
            return $query;
        }

        return $query->whereHas('assignments.job.personnelAssignments', fn (Builder $assignment): Builder => $assignment
            ->where('user_id', $user->id)->whereNull('active_until'));
    }
}
