<?php

namespace App\Enums;

enum PermissionName: string
{
    case DispatchViewAll = 'dispatch.view_all';
    case DispatchViewAssigned = 'dispatch.view_assigned';
    case DispatchCreate = 'dispatch.create';
    case DispatchUpdate = 'dispatch.update';
    case DispatchActivate = 'dispatch.activate';
    case DispatchCancel = 'dispatch.cancel';
    case DispatchApprovePriority = 'dispatch.approve_priority';
    case DispatchApproveChange = 'dispatch.approve_change';
    case DispatchApproveCancel = 'dispatch.approve_cancel';
    case DispatchUpdateOwnStatus = 'dispatch.update_own_status';
    case DispatchRespondOwn = 'dispatch.respond_own';
    case AssignmentsViewAll = 'assignments.view_all';
    case AssignmentsViewOwn = 'assignments.view_own';
    case AssignmentsCreate = 'assignments.create';
    case AssignmentsReassign = 'assignments.reassign';
    case AssignmentsApprove = 'assignments.approve';
    case AssignmentsOverride = 'assignments.override';
    case FleetViewAll = 'fleet.view_all';
    case FleetViewAssigned = 'fleet.view_assigned';
    case FleetRegister = 'fleet.register';
    case FleetUpdateStatus = 'fleet.update_status';
    case FleetInspect = 'fleet.inspect';
    case FleetMaintain = 'fleet.maintain';
    case EquipmentViewAll = 'equipment.view_all';
    case EquipmentViewAssigned = 'equipment.view_assigned';
    case EquipmentRegister = 'equipment.register';
    case EquipmentUpdateStatus = 'equipment.update_status';
    case EquipmentInspect = 'equipment.inspect';
    case EquipmentMaintain = 'equipment.maintain';
    case FuelViewAll = 'fuel.view_all';
    case FuelViewOwn = 'fuel.view_own';
    case FuelRequest = 'fuel.request';
    case FuelForward = 'fuel.forward';
    case FuelApprove = 'fuel.approve';
    case FuelRecord = 'fuel.record';
    case FuelVerify = 'fuel.verify';
    case FuelMonitor = 'fuel.monitor';
    case FuelReport = 'fuel.report';
    case TrackingShareOwn = 'tracking.share_own';
    case TrackingViewAll = 'tracking.view_all';
    case GptUseDispatch = 'gpt.use_dispatch';
    case GptUseOperations = 'gpt.use_operations';
    case GptUseMaintenance = 'gpt.use_maintenance';
    case GptConfigure = 'gpt.configure';
    case ReportsViewAll = 'reports.view_all';
    case ReportsViewDispatch = 'reports.view_dispatch';
    case ReportsViewOwn = 'reports.view_own';
    case ReportsViewMaintenance = 'reports.view_maintenance';
    case ReportsExport = 'reports.export';
    case UsersManage = 'users.manage';
    case RolesManage = 'roles.manage';
    case SystemConfigure = 'system.configure';
    case AuditView = 'audit.view';
    case ArchiveManage = 'archive.manage';
}
