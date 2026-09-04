<?php

namespace Database\Seeders;

use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Services\ProjectPlanService;
use App\Modules\Dispatch\Planning\Services\ProjectShiftService;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Opt-in synthetic acceptance scenario. Never called by DatabaseSeeder. */
final class ProjectPlanningDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Project planning demo data is limited to local and testing environments.');
        }
        if (ProjectPlan::query()->where('source_reference', 'DEMO-CORE1-BRIDGE-90')->exists()) {
            return;
        }
        $this->call(RolePermissionSeeder::class);
        DB::transaction(function (): void {
            $manager = $this->user('demo.planner', 'Demo Project Coordinator', RoleName::OperationsManager->value);
            $approver = $this->user('demo.approver', 'Demo Operations Approver', RoleName::OperationsManager->value);
            $operators = [$this->user('demo.operator.a', 'Alex Reyes', RoleName::CraneOperator->value), $this->user('demo.operator.b', 'Sam Cruz', RoleName::CraneOperator->value)];
            $riggers = [$this->user('demo.rigger.a', 'Jordan Santos', RoleName::Rigger->value), $this->user('demo.rigger.b', 'Casey Mendoza', RoleName::Rigger->value), $this->user('demo.rigger.c', 'Taylor Ramos', RoleName::Rigger->value), $this->user('demo.rigger.d', 'Morgan Garcia', RoleName::Rigger->value)];
            foreach ([...$operators, ...$riggers] as $person) {
                $person->personnelProfile()->create(['employee_number' => 'DEMO-'.$person->id, 'availability_status' => 'available']);
                $person->personnelCredentials()->create(['kind' => in_array($person, $operators, true) ? 'operator_certification' : 'rigger_certification', 'credential_number' => 'DEMO-CERT-'.$person->id, 'credential_type' => 'Demo qualification', 'status' => 'active', 'issued_at' => now()->subYear(), 'expires_at' => now()->addYear()]);
            }
            $asset = OperationalAsset::query()->create(['code' => 'DEMO-CR-90', 'name' => '90 t site crane', 'kind' => 'crane', 'status' => AssetStatus::Available]);
            $plans = app(ProjectPlanService::class);
            $shifts = app(ProjectShiftService::class);
            $plan = $plans->create($manager, ['name' => 'Riverside bridge · 90-day works', 'source_reference' => 'DEMO-CORE1-BRIDGE-90', 'client' => 'Demo Civil Works', 'site' => 'Riverside bridge site']);
            $start = now()->addDays(7)->startOfDay();
            $plan->refresh();
            $plans->savePhase($manager, $plan, ['version' => $plan->version, 'name' => 'Bridge lifting operations', 'kind' => 'operations', 'starts_at' => $start, 'ends_at' => $start->copy()->addDays(90), 'coverage' => ['crane_operator' => 1, 'driver' => 0, 'rigger' => 2]]);
            $phase = $plan->phases()->sole();
            $plan->refresh();
            $plans->saveAllocation($manager, $plan->refresh(), $phase->id, ['version' => $plan->version, 'operational_asset_id' => $asset->id, 'kind' => 'reservation', 'starts_at' => $phase->starts_at, 'ends_at' => $phase->ends_at, 'notes' => 'Crane remains on site throughout the project.']);
            $plan->refresh();
            $plans->saveAllocation($manager, $plan, $phase->id, ['version' => $plan->version, 'operational_asset_id' => $asset->id, 'kind' => 'maintenance', 'starts_at' => $start->copy()->addDays(2), 'ends_at' => $start->copy()->addDays(3), 'notes' => 'One operating day unavailable for scheduled maintenance.']);
            foreach ([7, 15] as $hour) {
                $plan->refresh();
                $shifts->generate($manager, $plan->refresh(), $phase->id, ['version' => $plan->version, 'starts_at' => $start->copy()->addHours($hour), 'ends_at' => $start->copy()->addHours($hour + 8), 'days' => 7]);
            }
            $plan->refresh();
            $plans->submit($manager, $plan, $plan->version);
            $plan->refresh();
            $plans->decide($approver, $plan, $plan->version, 'approved', 'Demo baseline independently reviewed.');
            foreach ($phase->shifts()->with('job')->get() as $shift) {
                $day = (int) $start->diffInDays($shift->job->scheduled_start->copy()->startOfDay());
                if ($day === 2) {
                    continue;
                }
                $team = $shift->job->scheduled_start->hour === 7 ? 0 : 1;
                $roster = [
                    ['user_id' => $riggers[$team * 2]->id, 'assignment_type' => 'rigger'],
                    ['user_id' => $riggers[$team * 2 + 1]->id, 'assignment_type' => 'rigger'],
                ];
                if (! ($day === 3 && $team === 0)) {
                    $roster[] = ['user_id' => $operators[$team]->id, 'assignment_type' => 'crane_operator'];
                }
                $plan->refresh();
                $shifts->roster($manager, $plan, $shift->id, ['version' => $plan->version, 'shift_version' => $shift->version, 'personnel' => $roster, 'reason' => 'Demo weekly shift crew, with one visible operator vacancy.']);
            }
        });
    }

    private function user(string $username, string $name, string $role): User
    {
        $user = User::query()->firstOrCreate(['username' => $username], ['name' => $name, 'email' => $username.'@example.test', 'password' => 'PlanningDemo!2026', 'is_active' => true, 'email_verified_at' => now()]);
        $user->assignRole($role);

        return $user;
    }
}
