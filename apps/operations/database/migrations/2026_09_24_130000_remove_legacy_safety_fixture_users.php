<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Purge deprecated legacy safety fixture accounts and reassign orphaned fixtures.
     */
    public function up(): void
    {
        $soMorales = DB::table('users')->where('email', 'so.morales@core2.ph')->first();
        $foremanDelacruz = DB::table('users')->where('email', 'foreman.delacruz@core2.ph')->first();

        if (! $soMorales && ! $foremanDelacruz) {
            return;
        }

        $manager = DB::table('users')->where('email', 'manager@example.com')->first();
        $operator = DB::table('users')->where('email', 'operator@example.com')->first();

        if ($soMorales) {
            $managerId = $manager?->id;

            if ($managerId !== null) {
                if (Schema::hasTable('dispatch_jobs')) {
                    DB::table('dispatch_jobs')->where('created_by', $soMorales->id)->update(['created_by' => $managerId]);
                }
                if (Schema::hasTable('dispatch_personnel_assignments')) {
                    DB::table('dispatch_personnel_assignments')->where('assigned_by', $soMorales->id)->update(['assigned_by' => $managerId]);
                }
                if (Schema::hasTable('dispatch_asset_assignments')) {
                    DB::table('dispatch_asset_assignments')->where('assigned_by', $soMorales->id)->update(['assigned_by' => $managerId]);
                }
                if (Schema::hasTable('toolbox_meetings') && Schema::hasColumn('toolbox_meetings', 'safety_officer_id')) {
                    DB::table('toolbox_meetings')->where('safety_officer_id', $soMorales->id)->update(['safety_officer_id' => $managerId]);
                }
                if (Schema::hasTable('site_hazard_tickets')) {
                    DB::table('site_hazard_tickets')->where('reporter_id', $soMorales->id)->update(['reporter_id' => $managerId]);
                }
                if (Schema::hasTable('work_stoppage_notices')) {
                    if (Schema::hasColumn('work_stoppage_notices', 'issued_by')) {
                        DB::table('work_stoppage_notices')->where('issued_by', $soMorales->id)->update(['issued_by' => $managerId]);
                    }
                    if (Schema::hasColumn('work_stoppage_notices', 'safety_officer_id')) {
                        DB::table('work_stoppage_notices')->where('safety_officer_id', $soMorales->id)->update(['safety_officer_id' => $managerId]);
                    }
                    if (Schema::hasColumn('work_stoppage_notices', 'lifted_by')) {
                        DB::table('work_stoppage_notices')->where('lifted_by', $soMorales->id)->update(['lifted_by' => $managerId]);
                    }
                }
                if (Schema::hasTable('personnel_credentials')) {
                    DB::table('personnel_credentials')->where('user_id', $soMorales->id)->update(['user_id' => $managerId]);
                }
            }

            if (Schema::hasTable('model_has_roles')) {
                DB::table('model_has_roles')->where('model_id', $soMorales->id)->delete();
            }
            if (Schema::hasTable('model_has_permissions')) {
                DB::table('model_has_permissions')->where('model_id', $soMorales->id)->delete();
            }
            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')
                    ->where('tokenable_id', $soMorales->id)
                    ->where('tokenable_type', 'App\\Platform\\Identity\\Models\\User')
                    ->delete();
            }
            DB::table('users')->where('id', $soMorales->id)->delete();
        }

        if ($foremanDelacruz) {
            $operatorId = $operator?->id;

            if ($operatorId !== null) {
                if (Schema::hasTable('dispatch_personnel_assignments')) {
                    DB::table('dispatch_personnel_assignments')->where('user_id', $foremanDelacruz->id)->update(['user_id' => $operatorId]);
                }
                if (Schema::hasTable('toolbox_meetings') && Schema::hasColumn('toolbox_meetings', 'conductor_id')) {
                    DB::table('toolbox_meetings')->where('conductor_id', $foremanDelacruz->id)->update(['conductor_id' => $operatorId]);
                }
                if (Schema::hasTable('critical_lift_plans') && Schema::hasColumn('critical_lift_plans', 'foreman_id')) {
                    DB::table('critical_lift_plans')->where('foreman_id', $foremanDelacruz->id)->update(['foreman_id' => $operatorId]);
                }
                if (Schema::hasTable('site_hazard_tickets')) {
                    DB::table('site_hazard_tickets')->where('reporter_id', $foremanDelacruz->id)->update(['reporter_id' => $operatorId]);
                }
                if (Schema::hasTable('command_logs')) {
                    DB::table('command_logs')->where('user_id', $foremanDelacruz->id)->update(['user_id' => $operatorId]);
                }
                if (Schema::hasTable('personnel_credentials')) {
                    DB::table('personnel_credentials')->where('user_id', $foremanDelacruz->id)->update(['user_id' => $operatorId]);
                }
            }

            if (Schema::hasTable('model_has_roles')) {
                DB::table('model_has_roles')->where('model_id', $foremanDelacruz->id)->delete();
            }
            if (Schema::hasTable('model_has_permissions')) {
                DB::table('model_has_permissions')->where('model_id', $foremanDelacruz->id)->delete();
            }
            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')
                    ->where('tokenable_id', $foremanDelacruz->id)
                    ->where('tokenable_type', 'App\\Platform\\Identity\\Models\\User')
                    ->delete();
            }
            DB::table('users')->where('id', $foremanDelacruz->id)->delete();
        }
    }

    public function down(): void
    {
        // Irreversible cleanup of deprecated test fixture accounts.
    }
};
