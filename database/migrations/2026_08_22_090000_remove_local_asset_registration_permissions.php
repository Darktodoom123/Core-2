<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private array $permissions = [
        'fleet.register',
        'equipment.register',
    ];

    public function up(): void
    {
        $permissionTable = config('permission.table_names.permissions', 'permissions');

        if (! Schema::hasTable($permissionTable)) {
            return;
        }

        $permissionIds = DB::table($permissionTable)
            ->whereIn('name', $this->permissions)
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        foreach (['role_has_permissions', 'model_has_permissions'] as $pivotTable) {
            if (Schema::hasTable($pivotTable)) {
                DB::table($pivotTable)->whereIn('permission_id', $permissionIds)->delete();
            }
        }

        DB::table($permissionTable)->whereIn('id', $permissionIds)->delete();
    }

    public function down(): void
    {
        $permissionTable = config('permission.table_names.permissions', 'permissions');

        if (! Schema::hasTable($permissionTable)) {
            return;
        }

        foreach ($this->permissions as $permission) {
            DB::table($permissionTable)->insertOrIgnore([
                'name' => $permission,
                'guard_name' => 'web',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
};
