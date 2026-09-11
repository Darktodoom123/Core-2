<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $roleName = 'dispatcher';

    private string $fallbackRoleName = 'operations_manager';

    public function up(): void
    {
        $roleTable = config('permission.table_names.roles', 'roles');
        $modelHasRolesTable = config('permission.table_names.model_has_roles', 'model_has_roles');
        $roleHasPermissionsTable = config('permission.table_names.role_has_permissions', 'role_has_permissions');

        if (! Schema::hasTable($roleTable)) {
            return;
        }

        $role = DB::table($roleTable)->where('name', $this->roleName)->first();
        if ($role === null) {
            return;
        }

        $fallbackRole = DB::table($roleTable)->where('name', $this->fallbackRoleName)->first();

        if ($fallbackRole !== null && Schema::hasTable($modelHasRolesTable)) {
            // Find all model assignments for dispatcher role
            $assignments = DB::table($modelHasRolesTable)
                ->where('role_id', $role->id)
                ->get();

            foreach ($assignments as $assignment) {
                // Ensure model also has fallback operations_manager role
                $exists = DB::table($modelHasRolesTable)
                    ->where('role_id', $fallbackRole->id)
                    ->where('model_type', $assignment->model_type)
                    ->where('model_id', $assignment->model_id)
                    ->exists();

                if (! $exists) {
                    DB::table($modelHasRolesTable)->insert([
                        'role_id' => $fallbackRole->id,
                        'model_type' => $assignment->model_type,
                        'model_id' => $assignment->model_id,
                    ]);
                }
            }

            DB::table($modelHasRolesTable)->where('role_id', $role->id)->delete();
        }

        if (Schema::hasTable($roleHasPermissionsTable)) {
            DB::table($roleHasPermissionsTable)->where('role_id', $role->id)->delete();
        }

        DB::table($roleTable)->where('id', $role->id)->delete();
    }

    public function down(): void
    {
        $roleTable = config('permission.table_names.roles', 'roles');

        if (! Schema::hasTable($roleTable)) {
            return;
        }

        DB::table($roleTable)->insertOrIgnore([
            'name' => $this->roleName,
            'guard_name' => 'web',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
