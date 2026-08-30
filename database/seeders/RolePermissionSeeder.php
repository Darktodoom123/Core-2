<?php

namespace Database\Seeders;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
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
            static fn (string $permission): bool => ! in_array($permission, [
                PermissionName::TrackingShareOwn->value,
                PermissionName::SosTrigger->value,
                PermissionName::SosRespond->value,
                PermissionName::FuelRequest->value,
                PermissionName::FuelRecord->value,
            ], true)
        ));

        return [
            RoleName::SystemAdministrator->value => $adminPermissions,
            RoleName::OperationsManager->value => self::values([
                PermissionName::DispatchViewAll, PermissionName::DispatchCreate, PermissionName::DispatchUpdate,
                PermissionName::DispatchActivate, PermissionName::DispatchCancel,
                PermissionName::DispatchApprovePriority, PermissionName::DispatchApproveChange,
                PermissionName::DispatchApproveCancel, PermissionName::AssignmentsViewAll,
                PermissionName::AssignmentsCreate, PermissionName::AssignmentsReassign,
                PermissionName::AssignmentsApprove, PermissionName::AssignmentsOverride,
                PermissionName::FleetViewAll, PermissionName::FleetUpdateStatus,
                PermissionName::FleetInspect, PermissionName::FleetMaintain,
                PermissionName::EquipmentViewAll, PermissionName::EquipmentUpdateStatus,
                PermissionName::EquipmentInspect, PermissionName::EquipmentMaintain,
                PermissionName::FuelViewAll, PermissionName::FuelForward, PermissionName::FuelApprove,
                PermissionName::FuelVerify, PermissionName::FuelMonitor,
                PermissionName::FuelReport, PermissionName::TrackingViewAll,
                PermissionName::GptUseDispatch, PermissionName::GptUseOperations,
                PermissionName::ReportsViewAll, PermissionName::ReportsViewDispatch, PermissionName::ReportsViewMaintenance, PermissionName::ReportsExport,
                PermissionName::RentalView, PermissionName::RentalCreate, PermissionName::RentalApprove, PermissionName::RentalAssignOperator, PermissionName::RentalCheckout,
                PermissionName::RentalReturn, PermissionName::SalesView, PermissionName::SalesCatalogManage,
                PermissionName::SalesCreateQuote,
                PermissionName::SalesApproveOrder, PermissionName::SalesFulfill, PermissionName::SalesTransferOwnership,
                PermissionName::SosView, PermissionName::SosRespond,
                PermissionName::SafetyTbmSubmit, PermissionName::SafetyTbmCoSign,
                PermissionName::SafetyLiftPlanCreate, PermissionName::SafetyLiftPlanApprove,
                PermissionName::SafetyHazardReport, PermissionName::SafetyHazardRectify,
                PermissionName::SafetyWorkStoppageIssue, PermissionName::SafetyWorkStoppageLift,
            ]),
            RoleName::SafetyOfficer->value => self::values([
                PermissionName::DispatchViewAll,
                PermissionName::AssignmentsViewAll,
                PermissionName::FleetViewAll, PermissionName::FleetUpdateStatus,
                PermissionName::FleetInspect, PermissionName::FleetMaintain,
                PermissionName::EquipmentViewAll, PermissionName::EquipmentUpdateStatus,
                PermissionName::EquipmentInspect, PermissionName::EquipmentMaintain,
                PermissionName::TrackingViewAll,
                PermissionName::ReportsViewAll, PermissionName::ReportsViewDispatch, PermissionName::ReportsViewMaintenance, PermissionName::ReportsExport,
                PermissionName::SosView, PermissionName::SosRespond,
                PermissionName::SafetyTbmCoSign,
                PermissionName::SafetyLiftPlanApprove,
                PermissionName::SafetyHazardReport, PermissionName::SafetyHazardRectify,
                PermissionName::SafetyWorkStoppageIssue, PermissionName::SafetyWorkStoppageLift,
            ]),
            RoleName::FieldForeman->value => self::values([
                PermissionName::DispatchViewAll, PermissionName::DispatchViewAssigned, PermissionName::DispatchRespondOwn, PermissionName::DispatchUpdateOwnStatus,
                PermissionName::AssignmentsViewAll, PermissionName::AssignmentsViewOwn,
                PermissionName::FleetViewAll, PermissionName::FleetViewAssigned, PermissionName::FleetInspect, PermissionName::FleetUpdateStatus,
                PermissionName::EquipmentViewAll, PermissionName::EquipmentViewAssigned, PermissionName::EquipmentInspect, PermissionName::EquipmentUpdateStatus,
                PermissionName::FuelViewAll, PermissionName::FuelViewOwn, PermissionName::FuelRequest, PermissionName::FuelRecord, PermissionName::FuelForward,
                PermissionName::TrackingShareOwn, PermissionName::TrackingViewAll,
                PermissionName::ReportsViewAll, PermissionName::ReportsViewDispatch, PermissionName::ReportsViewOwn, PermissionName::ReportsExport,
                PermissionName::SosTrigger, PermissionName::SosView,
                PermissionName::RentalOperate,
                PermissionName::SafetyTbmSubmit,
                PermissionName::SafetyLiftPlanCreate,
                PermissionName::SafetyHazardReport,
            ]),
            RoleName::CraneOperator->value => self::values([
                PermissionName::DispatchViewAssigned, PermissionName::DispatchRespondOwn, PermissionName::DispatchUpdateOwnStatus, PermissionName::RentalOperate,
                PermissionName::AssignmentsViewOwn, PermissionName::FleetViewAssigned, PermissionName::EquipmentViewAssigned, PermissionName::EquipmentUpdateStatus,
                PermissionName::FuelViewOwn, PermissionName::FuelRequest, PermissionName::FuelRecord,
                PermissionName::TrackingShareOwn, PermissionName::ReportsViewOwn,
                PermissionName::SosTrigger,
                PermissionName::SafetyHazardReport,
            ]),
            RoleName::Rigger->value => self::values([
                PermissionName::DispatchViewAssigned, PermissionName::DispatchRespondOwn,
                PermissionName::AssignmentsViewOwn, PermissionName::EquipmentViewAssigned,
                PermissionName::ReportsViewOwn,
                PermissionName::SosTrigger,
                PermissionName::SafetyHazardReport,
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
