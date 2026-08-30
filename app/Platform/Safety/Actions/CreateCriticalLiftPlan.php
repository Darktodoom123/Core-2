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
     *     gross_load_weight_tons?: float,
     *     net_load_weight_tons?: float|null,
     *     rigging_weight_tons?: float,
     *     hook_block_weight_tons?: float,
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

        $riggingWeight = (float) ($data['rigging_weight_tons'] ?? 0);
        $hookBlockWeight = (float) ($data['hook_block_weight_tons'] ?? 0);
        $netLoadWeight = isset($data['net_load_weight_tons']) ? (float) $data['net_load_weight_tons'] : null;

        $grossLoadWeight = (float) ($data['gross_load_weight_tons'] ?? ($netLoadWeight !== null ? $netLoadWeight + $riggingWeight + $hookBlockWeight : 0));
        $workingRadius = (float) $data['working_radius_meters'];
        $loadMoment = round($grossLoadWeight * $workingRadius, 2);

        $loadPercentage = ($grossLoadWeight / $data['crane_rated_capacity_tons']) * 100;
        if ($loadPercentage > 95) {
            throw ValidationException::withMessages([
                'gross_load_weight_tons' => 'DOLE Safety Limit Exceeded: Gross load exceeds 95% of crane rated capacity.',
            ]);
        }

        $riskLevel = $data['risk_level'] ?? match (true) {
            $loadPercentage >= 85 => 'critical',
            $loadPercentage >= 75 => 'standard_engineered',
            default => 'routine',
        };

        return DB::transaction(function () use ($foreman, $data, $grossLoadWeight, $netLoadWeight, $riggingWeight, $hookBlockWeight, $loadMoment, $loadPercentage, $riskLevel): CriticalLiftPlan {
            $reference = sprintf('LIFT-%s-%s', date('Ymd'), strtoupper(Str::random(4)));

            return CriticalLiftPlan::query()->create([
                'lift_reference' => $reference,
                'dispatch_job_id' => $data['dispatch_job_id'] ?? null,
                'operational_asset_id' => $data['operational_asset_id'] ?? null,
                'project_site' => $data['project_site'],
                'crane_operator_id' => $data['crane_operator_id'] ?? null,
                'lead_rigger_id' => $data['lead_rigger_id'] ?? null,
                'rigger_tesda_nc_number' => $data['rigger_tesda_nc_number'],
                'risk_level' => $riskLevel,
                'gross_load_weight_tons' => $grossLoadWeight,
                'net_load_weight_tons' => $netLoadWeight,
                'rigging_weight_tons' => $riggingWeight,
                'hook_block_weight_tons' => $hookBlockWeight,
                'crane_rated_capacity_tons' => $data['crane_rated_capacity_tons'],
                'load_percentage_of_capacity' => round($loadPercentage, 2),
                'boom_length_meters' => $data['boom_length_meters'],
                'working_radius_meters' => $data['working_radius_meters'],
                'load_moment_ton_meters' => $loadMoment,
                'ground_bearing_condition' => $data['ground_bearing_condition'],
                'weather_wind_speed_kph' => $data['weather_wind_speed_kph'] ?? 0,
                'status' => 'pending_so_review',
                'foreman_id' => $foreman->id,
                'foreman_signed_at' => Carbon::now(),
            ]);
        });
    }
}
