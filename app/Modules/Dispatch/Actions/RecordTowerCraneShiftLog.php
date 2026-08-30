<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Models\TowerCraneShiftLog;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class RecordTowerCraneShiftLog
{
    /**
     * @param array{
     *     dispatch_job_id?: int|null,
     *     operational_asset_id: int,
     *     shift_date?: string|null,
     *     shift_type?: string,
     *     pre_climb_passed?: bool,
     *     pre_climb_harness_inspected?: bool,
     *     pre_climb_ladder_cleared?: bool,
     *     anemometer_verified?: bool,
     *     operating_hours?: float,
     *     lift_count?: int,
     *     free_slew_engaged?: bool,
     *     notes?: string|null,
     * } $data
     */
    public function handle(User $operator, array $data): TowerCraneShiftLog
    {
        $hasQualifiedRole = $operator->hasRole(RoleName::CraneOperator->value)
            || $operator->hasRole(RoleName::FieldForeman->value);

        if (! $hasQualifiedRole) {
            throw ValidationException::withMessages([
                'operator_id' => 'User must have an operator or foreman role to record a tower crane shift log.',
            ]);
        }

        $asset = OperationalAsset::query()->findOrFail($data['operational_asset_id']);
        if (! $asset->isStationary()) {
            throw ValidationException::withMessages([
                'operational_asset_id' => 'Selected asset is not a stationary or tower crane.',
            ]);
        }

        $preClimbPassed = (bool) ($data['pre_climb_passed'] ?? (
            ($data['pre_climb_harness_inspected'] ?? false) &&
            ($data['pre_climb_ladder_cleared'] ?? false) &&
            ($data['anemometer_verified'] ?? false)
        ));

        return DB::transaction(function () use ($operator, $data, $preClimbPassed): TowerCraneShiftLog {
            return TowerCraneShiftLog::query()->create([
                'dispatch_job_id' => $data['dispatch_job_id'] ?? null,
                'operational_asset_id' => $data['operational_asset_id'],
                'operator_id' => $operator->id,
                'shift_date' => isset($data['shift_date']) ? Carbon::parse($data['shift_date']) : Carbon::today(),
                'shift_type' => $data['shift_type'] ?? 'day',
                'pre_climb_passed' => $preClimbPassed,
                'pre_climb_harness_inspected' => (bool) ($data['pre_climb_harness_inspected'] ?? false),
                'pre_climb_ladder_cleared' => (bool) ($data['pre_climb_ladder_cleared'] ?? false),
                'anemometer_verified' => (bool) ($data['anemometer_verified'] ?? false),
                'operating_hours' => (float) ($data['operating_hours'] ?? 0),
                'lift_count' => (int) ($data['lift_count'] ?? 0),
                'free_slew_engaged' => (bool) ($data['free_slew_engaged'] ?? false),
                'notes' => $data['notes'] ?? null,
            ]);
        });
    }
}
