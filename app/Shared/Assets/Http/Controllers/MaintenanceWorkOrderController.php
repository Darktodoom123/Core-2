<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class MaintenanceWorkOrderController extends Controller
{
    public function store(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

        $validated = $request->validate([
            'defect' => ['required', 'string', 'max:5000'],
            'dispatch_blocking' => ['required', 'boolean'],
            'scheduled_at' => ['nullable', 'date'],
            'next_due_at' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $work = DB::transaction(function () use ($request, $operationalAsset, $validated, $audit): MaintenanceWorkOrder {
            $work = $operationalAsset->maintenanceWorkOrders()->create([
                ...$validated,
                'technician_id' => $request->user()->id,
                'status' => AssetStatus::UnderMaintenance->value,
            ]);
            $operationalAsset->update(['status' => AssetStatus::UnderMaintenance]);
            $audit->handle($request->user(), $work, 'maintenance.opened', null, $work->toArray());

            return $work;
        });

        if ($request->expectsJson()) {
            return response()->json(['data' => $work], 201);
        }

        return to_route('home')->with('flash', [
            'tone' => 'warning',
            'message' => "Maintenance work order opened for {$operationalAsset->code}.",
        ]);
    }

    public function release(Request $request, MaintenanceWorkOrder $maintenanceWorkOrder, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $asset = $maintenanceWorkOrder->asset;
        $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

        $validated = $request->validate([
            'work_performed' => ['required', 'array', 'min:1'],
            'parts' => ['sometimes', 'array'],
            'release_checklist' => ['nullable', 'array'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'next_due_at' => ['nullable', 'date'],
        ]);

        if (! $asset->inspections()->where('result', 'passed')->where('completed_at', '>=', $maintenanceWorkOrder->created_at)->exists()) {
            throw ValidationException::withMessages([
                'inspection' => 'A passing inspection completed after the repair is required before releasing a blocking maintenance order.',
            ]);
        }

        DB::transaction(function () use ($request, $maintenanceWorkOrder, $asset, $validated, $audit): void {
            $updateData = [
                'work_performed' => $validated['work_performed'],
                'parts' => $validated['parts'] ?? [],
                'status' => AssetStatus::ReadyForService->value,
                'dispatch_blocking' => false,
                'released_at' => now(),
                'release_verified_by' => $request->user()->id,
            ];

            if (isset($validated['release_checklist'])) {
                $updateData['release_checklist'] = $validated['release_checklist'];
            }
            if (isset($validated['remarks'])) {
                $updateData['remarks'] = $validated['remarks'];
            }
            if (isset($validated['next_due_at'])) {
                $updateData['next_due_at'] = $validated['next_due_at'];
            }

            $maintenanceWorkOrder->update($updateData);

            if (! $asset->maintenanceWorkOrders()->where('dispatch_blocking', true)->whereNull('released_at')->exists()) {
                $asset->update(['status' => AssetStatus::ReadyForService]);
            }

            $audit->handle($request->user(), $maintenanceWorkOrder, 'maintenance.released', null, [
                'status' => AssetStatus::ReadyForService->value,
                'released_at' => now()->toIso8601String(),
                'release_verified_by' => $request->user()->id,
            ]);
        });

        if ($request->expectsJson()) {
            return response()->json(['data' => $maintenanceWorkOrder->refresh()]);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Maintenance work order for {$asset->code} released and verified.",
        ]);
    }
}
