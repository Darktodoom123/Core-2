<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\CriticalLiftPlan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class CreateCriticalLiftPlan
{
    /**
     * @param array{
     *     dispatch_job_id?: int|null,
     *     operational_asset_id?: int|null,
     *     project_site: string,
     *     crane_operator_id?: int|null,
     *     lead_rigger_id?: int|null,
     *     rigger_tesda_nc_number: string,
     *     risk_level?: string,
     *     gross_load_weight_tons: float,
     *     crane_rated_capacity_tons: float,
     *     boom_length_meters: float,
     *     working_radius_meters: float,
     *     ground_bearing_condition: string,
     *     weather_wind_speed_kph?: float,
     * } $data
     */
    public function handle(User $foreman, array $data): CriticalLiftPlan
    {
        if ($data['crane_rated_capacity_tons'] <= 0) {
            throw ValidationException::withMessages([
                'crane_rated_capacity_tons' => 'Crane rated capacity must be greater than zero.',
            ]);
        }

        $loadPercentage = ($data['gross_load_weight_tons'] / $data['crane_rated_capacity_tons']) * 100;
        if ($loadPercentage > 95) {
            throw ValidationException::withMessages([
                'gross_load_weight_tons' => 'DOLE Safety Limit Exceeded: Gross load exceeds 95% of crane rated capacity.',
            ]);
        }

        return DB::transaction(function () use ($foreman, $data, $loadPercentage): CriticalLiftPlan {
            $reference = sprintf('LIFT-%s-%s', date('Ymd'), strtoupper(Str::random(4)));

            return CriticalLiftPlan::query()->create([
                'lift_reference' => $reference,
                'dispatch_job_id' => $data['dispatch_job_id'] ?? null,
                'operational_asset_id' => $data['operational_asset_id'] ?? null,
                'project_site' => $data['project_site'],
                'crane_operator_id' => $data['crane_operator_id'] ?? null,
                'lead_rigger_id' => $data['lead_rigger_id'] ?? null,
                'rigger_tesda_nc_number' => $data['rigger_tesda_nc_number'],
                'risk_level' => $data['risk_level'] ?? ($loadPercentage >= 80 ? 'critical' : 'routine'),
                'gross_load_weight_tons' => $data['gross_load_weight_tons'],
                'crane_rated_capacity_tons' => $data['crane_rated_capacity_tons'],
                'load_percentage_of_capacity' => round($loadPercentage, 2),
                'boom_length_meters' => $data['boom_length_meters'],
                'working_radius_meters' => $data['working_radius_meters'],
                'ground_bearing_condition' => $data['ground_bearing_condition'],
                'weather_wind_speed_kph' => $data['weather_wind_speed_kph'] ?? 0,
                'status' => 'pending_so_review',
                'foreman_id' => $foreman->id,
                'foreman_signed_at' => Carbon::now(),
            ]);
        });
    }
}
