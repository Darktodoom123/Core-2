<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    // Users are stored under their legacy morph alias; accept the class name too.
    private const USER_MODEL_TYPES = ['App\\Models\\User', 'App\\Platform\\Identity\\Models\\User'];

    /**
     * Crews are staffed by Operators only. Remove the rigger role and every
     * rigger crew slot so no job, phase, or shift waits on a role nobody holds.
     */
    public function up(): void
    {
        $this->stripDispatchRequirements();
        $this->stripPhaseCoverage();
        $this->stripPendingRosters();
        $this->retireRiggerAccounts();
        $this->retireRiggerCertifications();

        if (Schema::hasColumn('critical_lift_plans', 'lead_rigger_id')) {
            Schema::table('critical_lift_plans', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('lead_rigger_id');
                $table->dropColumn('rigger_tesda_nc_number');
            });
        }
    }

    public function down(): void
    {
        // Rigger crew data is discarded on purpose; only the lift plan columns return.
        if (Schema::hasTable('critical_lift_plans') && ! Schema::hasColumn('critical_lift_plans', 'lead_rigger_id')) {
            Schema::table('critical_lift_plans', function (Blueprint $table): void {
                $table->foreignId('lead_rigger_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('rigger_tesda_nc_number', 64)->nullable();
            });
        }
    }

    private function stripDispatchRequirements(): void
    {
        DB::table('dispatch_jobs')->whereNotNull('resource_requirements')->orderBy('id')
            ->select(['id', 'resource_requirements'])
            ->each(function (object $job): void {
                $requirements = json_decode((string) $job->resource_requirements, true);
                if (! is_array($requirements['personnel'] ?? null) || ! array_key_exists('rigger', $requirements['personnel'])) {
                    return;
                }

                unset($requirements['personnel']['rigger']);
                DB::table('dispatch_jobs')->where('id', $job->id)->update(['resource_requirements' => json_encode($requirements)]);
            });
    }

    private function stripPhaseCoverage(): void
    {
        DB::table('dispatch_project_phases')->orderBy('id')->select(['id', 'coverage'])
            ->each(function (object $phase): void {
                $coverage = json_decode((string) $phase->coverage, true);
                if (! is_array($coverage) || ! array_key_exists('rigger', $coverage)) {
                    return;
                }

                unset($coverage['rigger']);
                DB::table('dispatch_project_phases')->where('id', $phase->id)->update(['coverage' => json_encode($coverage)]);
            });
    }

    private function stripPendingRosters(): void
    {
        DB::table('dispatch_project_shifts')->whereNotNull('pending_roster')->orderBy('id')
            ->select(['id', 'pending_roster'])
            ->each(function (object $shift): void {
                $roster = json_decode((string) $shift->pending_roster, true);
                if (! is_array($roster)) {
                    return;
                }

                $kept = array_values(array_filter($roster, static fn (mixed $entry): bool => ($entry['assignment_type'] ?? null) !== 'rigger'));
                if (count($kept) !== count($roster)) {
                    DB::table('dispatch_project_shifts')->where('id', $shift->id)->update(['pending_roster' => json_encode($kept)]);
                }
            });
    }

    private function retireRiggerAccounts(): void
    {
        $roleId = DB::table('roles')->where('name', 'rigger')->value('id');
        if ($roleId === null) {
            return;
        }

        $riggerIds = DB::table('model_has_roles')->where('role_id', $roleId)->whereIn('model_type', self::USER_MODEL_TYPES)->pluck('model_id');
        $otherRoleHolders = DB::table('model_has_roles')->whereIn('model_id', $riggerIds)->whereIn('model_type', self::USER_MODEL_TYPES)
            ->where('role_id', '!=', $roleId)->pluck('model_id');
        $riggerOnly = $riggerIds->diff($otherRoleHolders)->values();

        // Keep the accounts for audit history, but they can no longer sign in.
        DB::table('users')->whereIn('id', $riggerOnly)->update(['is_active' => false]);
        DB::table('personal_access_tokens')->whereIn('tokenable_type', self::USER_MODEL_TYPES)->whereIn('tokenable_id', $riggerOnly)->delete();

        DB::table('model_has_roles')->where('role_id', $roleId)->delete();
        DB::table('role_has_permissions')->where('role_id', $roleId)->delete();
        DB::table('roles')->where('id', $roleId)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    private function retireRiggerCertifications(): void
    {
        // Keep the certificate records; they become general qualifications.
        DB::table('personnel_credentials')->where('kind', 'rigger_certification')->update(['kind' => 'qualification']);

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table personnel_credentials drop constraint if exists personnel_credentials_kind_check');
            DB::statement("alter table personnel_credentials add constraint personnel_credentials_kind_check check (kind in ('driver_license', 'operator_certification', 'qualification'))");
        }
    }
};
