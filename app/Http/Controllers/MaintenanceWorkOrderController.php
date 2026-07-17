<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\AssetStatus;
use App\Enums\PermissionName;
use App\Models\MaintenanceWorkOrder;
use App\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class MaintenanceWorkOrderController extends Controller
{
    public function store(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit): JsonResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);
        $validated = $request->validate(['defect' => ['required', 'string', 'max:5000'], 'dispatch_blocking' => ['required', 'boolean']]);
        $work = DB::transaction(function () use ($request, $operationalAsset, $validated, $audit) {
            $work = $operationalAsset->maintenanceWorkOrders()->create([...$validated, 'technician_id' => $request->user()->id, 'status' => AssetStatus::UnderMaintenance->value]);
            $operationalAsset->update(['status' => AssetStatus::UnderMaintenance]);
            $audit->handle($request->user(), $work, 'maintenance.opened', null, $work->toArray());

            return $work;
        });

        return response()->json(['data' => $work], 201);
    }

    public function release(Request $request, MaintenanceWorkOrder $maintenanceWorkOrder, RecordAuditEvent $audit): JsonResponse
    {
        $asset = $maintenanceWorkOrder->asset;
        $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);
        $validated = $request->validate(['work_performed' => ['required', 'array', 'min:1'], 'parts' => ['sometimes', 'array']]);
        if (! $asset->inspections()->where('result', 'passed')->where('completed_at', '>=', $maintenanceWorkOrder->created_at)->exists()) {
            throw ValidationException::withMessages(['inspection' => 'A passing inspection completed after the repair is required.']);
        }
        DB::transaction(function () use ($request, $maintenanceWorkOrder, $asset, $validated, $audit): void {
            $maintenanceWorkOrder->update([...$validated, 'status' => AssetStatus::ReadyForService->value, 'dispatch_blocking' => false, 'released_at' => now()]);
            if (! $asset->maintenanceWorkOrders()->where('dispatch_blocking', true)->whereNull('released_at')->exists()) {
                $asset->update(['status' => AssetStatus::ReadyForService]);
            }
            $audit->handle($request->user(), $maintenanceWorkOrder, 'maintenance.released', null, ['status' => AssetStatus::ReadyForService->value]);
        });

        return response()->json(['data' => $maintenanceWorkOrder->refresh()]);
    }
}
