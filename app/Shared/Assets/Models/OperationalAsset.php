<?php

namespace App\Shared\Assets\Models;

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
 * @property string $name
 * @property string $kind
 * @property string|null $subtype
 * @property AssetStatus $status
 * @property string|null $location
 * @property array<string, mixed>|null $specifications
 * @property string|null $registration_number
 * @property string|null $manufacturer
 * @property string|null $model
 * @property string|null $rated_capacity
 * @property string|null $capacity_unit
 * @property string|null $meter_type
 * @property string|null $meter_value
 * @property string|null $baseline_burn_rate
 * @property string|null $burn_rate_unit
 */
class OperationalAsset extends Model
{
    use SoftDeletes;

    protected $fillable = ['code', 'name', 'kind', 'subtype', 'status', 'location', 'specifications', 'registration_number', 'manufacturer', 'model', 'rated_capacity', 'capacity_unit', 'meter_type', 'meter_value', 'baseline_burn_rate', 'burn_rate_unit'];

    protected function casts(): array
    {
        return ['status' => AssetStatus::class, 'specifications' => 'array', 'rated_capacity' => 'decimal:2', 'meter_value' => 'decimal:2', 'baseline_burn_rate' => 'decimal:2'];
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

        return $query->whereExists(function ($assignment) use ($user): void {
            $assignment->selectRaw('1')
                ->from('dispatch_asset_assignments as asset_assignments')
                ->join('dispatch_personnel_assignments as personnel_assignments', 'personnel_assignments.dispatch_job_id', '=', 'asset_assignments.dispatch_job_id')
                ->whereColumn('asset_assignments.operational_asset_id', 'operational_assets.id')
                ->whereNull('asset_assignments.active_until')
                ->where('personnel_assignments.user_id', $user->id)
                ->whereNull('personnel_assignments.active_until');
        });
    }

    public function isStationary(): bool
    {
        $subtype = strtolower((string) $this->subtype);
        $kind = strtolower((string) $this->kind);

        return str_contains($subtype, 'tower')
            || str_contains($subtype, 'hoist')
            || str_contains($subtype, 'climbing')
            || $kind === 'tower_crane'
            || $kind === 'hoist';
    }

    public function requiresRoadTransit(): bool
    {
        return ! $this->isStationary();
    }
}
