<?php

namespace Database\Seeders;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (PermissionName::cases() as $permission) {
            Permission::findOrCreate($permission->value, 'web');
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::rolePermissions() as $roleName => $permissions) {
            Role::findOrCreate($roleName, 'web')->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** @return array<string, list<string>> */
    public static function rolePermissions(): array
    {
        $all = array_map(static fn (PermissionName $permission): string => $permission->value, PermissionName::cases());
        $adminPermissions = array_values(array_filter(
            $all,
            static fn (string $permission): bool => $permission !== PermissionName::TrackingShareOwn->value
        ));

        return [
            RoleName::SystemAdministrator->value => $adminPermissions,
            RoleName::Dispatcher->value => self::values([
                PermissionName::DispatchViewAll, PermissionName::DispatchCreate, PermissionName::DispatchUpdate,
                PermissionName::DispatchActivate, PermissionName::DispatchCancel, PermissionName::AssignmentsViewAll, PermissionName::AssignmentsCreate,
                PermissionName::AssignmentsReassign, PermissionName::FleetViewAll, PermissionName::FleetRegister, PermissionName::FleetUpdateStatus,
                PermissionName::EquipmentViewAll, PermissionName::EquipmentRegister, PermissionName::EquipmentUpdateStatus, PermissionName::FuelViewAll,
                PermissionName::FuelForward, PermissionName::FuelMonitor, PermissionName::TrackingViewAll,
                PermissionName::GptUseDispatch, PermissionName::ReportsViewDispatch,
            ]),
            RoleName::OperationsManager->value => self::values([
                PermissionName::DispatchViewAll, PermissionName::DispatchApprovePriority, PermissionName::DispatchApproveChange,
                PermissionName::DispatchApproveCancel, PermissionName::AssignmentsViewAll, PermissionName::AssignmentsApprove,
                PermissionName::AssignmentsOverride, PermissionName::FleetViewAll, PermissionName::FleetRegister, PermissionName::FleetUpdateStatus, PermissionName::EquipmentViewAll, PermissionName::EquipmentRegister, PermissionName::EquipmentUpdateStatus,
                PermissionName::FuelViewAll, PermissionName::FuelApprove, PermissionName::FuelMonitor,
                PermissionName::FuelReport, PermissionName::TrackingViewAll, PermissionName::GptUseOperations,
                PermissionName::ReportsViewAll, PermissionName::ReportsExport,
            ]),
            RoleName::Driver->value => self::values([
                PermissionName::DispatchViewAssigned, PermissionName::DispatchRespondOwn, PermissionName::DispatchUpdateOwnStatus,
                PermissionName::AssignmentsViewOwn, PermissionName::FleetViewAssigned, PermissionName::FuelViewOwn,
                PermissionName::FuelRequest, PermissionName::FuelRecord, PermissionName::TrackingShareOwn,
                PermissionName::ReportsViewOwn,
            ]),
            RoleName::CraneOperator->value => self::values([
                PermissionName::DispatchViewAssigned, PermissionName::DispatchRespondOwn, PermissionName::DispatchUpdateOwnStatus,
                PermissionName::AssignmentsViewOwn, PermissionName::EquipmentViewAssigned, PermissionName::EquipmentUpdateStatus,
                PermissionName::FuelViewOwn, PermissionName::FuelRequest, PermissionName::FuelRecord,
                PermissionName::TrackingShareOwn, PermissionName::ReportsViewOwn,
            ]),
            RoleName::FieldTechnician->value => self::values([
                PermissionName::DispatchViewAssigned, PermissionName::DispatchRespondOwn, PermissionName::DispatchUpdateOwnStatus, PermissionName::AssignmentsViewOwn,
                PermissionName::FleetViewAssigned, PermissionName::FleetUpdateStatus, PermissionName::FleetInspect,
                PermissionName::FleetMaintain, PermissionName::EquipmentViewAssigned, PermissionName::EquipmentUpdateStatus,
                PermissionName::EquipmentInspect, PermissionName::EquipmentMaintain, PermissionName::FuelViewOwn,
                PermissionName::FuelRecord, PermissionName::FuelVerify, PermissionName::TrackingShareOwn,
                PermissionName::GptUseMaintenance, PermissionName::ReportsViewMaintenance,
            ]),
        ];
    }

    /** @param list<PermissionName> $permissions
     * @return list<string>
     */
    private static function values(array $permissions): array
    {
        return array_map(static fn (PermissionName $permission): string => $permission->value, $permissions);
    }
}
