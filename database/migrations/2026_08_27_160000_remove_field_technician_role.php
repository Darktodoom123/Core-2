<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private string $roleName = 'field_technician';

    public function up(): void
    {
        $roleTable = config('permission.table_names.roles', 'roles');
        $modelHasRolesTable = config('permission.table_names.model_has_roles', 'model_has_roles');
        $roleHasPermissionsTable = config('permission.table_names.role_has_permissions', 'role_has_permissions');

        if (! Schema::hasTable($roleTable)) {
            return;
        }

        $roleIds = DB::table($roleTable)
            ->where('name', $this->roleName)
            ->pluck('id');

        if ($roleIds->isEmpty()) {
            return;
        }

        if (Schema::hasTable($modelHasRolesTable)) {
            DB::table($modelHasRolesTable)->whereIn('role_id', $roleIds)->delete();
        }

        if (Schema::hasTable($roleHasPermissionsTable)) {
            DB::table($roleHasPermissionsTable)->whereIn('role_id', $roleIds)->delete();
        }

        DB::table($roleTable)->whereIn('id', $roleIds)->delete();
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
