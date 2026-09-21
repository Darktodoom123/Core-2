<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

final class InspectionController extends Controller
{
    public function store(
        Request $request,
        OperationalAsset $operationalAsset,
        RecordAuditEvent $audit,
        OperationalAssetStatusGuard $statusGuard,
        IdempotentCommandService $idempotentCommandService,
    ): Response {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetInspect : PermissionName::EquipmentInspect)->value);

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:pre_operation,post_operation,maintenance,safety,post_repair'],
            'result' => ['required', 'string', 'in:passed,failed,conditional'],
            'checklist' => ['required', 'array', 'min:1'],
            'findings' => ['nullable', 'string', 'max:5000'],
        ]);

        $commandId = $idempotentCommandService->resolveCommandId($request);

        $execute = function () use ($request, $operationalAsset, $validated, $audit, $statusGuard): Response {
            $inspection = DB::transaction(function () use ($request, $operationalAsset, $validated, $audit, $statusGuard): Inspection {
                $asset = OperationalAsset::query()->withTrashed()->lockForUpdate()->findOrFail($operationalAsset->id);
                $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
                Gate::forUser($request->user())->authorize(($isFleet ? PermissionName::FleetInspect : PermissionName::EquipmentInspect)->value);
                $inspection = $asset->inspections()->create([
                    ...$validated,
                    'technician_id' => $request->user()->id,
                    'completed_at' => now(),
                ]);

                $hasCritical = false;
                $criticalLabels = [];
                if (is_array($validated['checklist'])) {
                    foreach ($validated['checklist'] as $check) {
                        if (is_array($check) && ($check['status'] ?? null) === 'critical') {
                            $hasCritical = true;
                            $criticalLabels[] = (string) ($check['label'] ?? $check['id'] ?? 'Critical check item');
                        }
                    }
                }
                $criticalItems = implode(', ', $criticalLabels);

                $hasOpenBlockingWorkOrders = $asset->maintenanceWorkOrders()
                    ->where('dispatch_blocking', true)
                    ->whereNull('released_at')
                    ->exists();

                if ($validated['result'] !== 'passed') {
                    if ($hasCritical) {
                        $statusGuard->transition($asset, AssetStatus::UnderMaintenance, new AssetUsageRequest(
                            assetId: (int) $asset->id,
                            usageType: AssetUsageType::AssetStatusChange,
                            targetStatus: AssetStatus::UnderMaintenance,
                        ));

                        if (! $hasOpenBlockingWorkOrders) {

                            $workOrder = $asset->maintenanceWorkOrders()->create([
                                'technician_id' => $request->user()->id,
                                'status' => AssetStatus::UnderMaintenance->value,
                                'defect' => "Critical inspection findings: {$criticalItems}".(! empty($validated['findings']) ? " ({$validated['findings']})" : ''),
                                'dispatch_blocking' => true,
                                'scheduled_at' => now(),
                                'remarks' => "Automatic lockout triggered by inspection #{$inspection->id}",
                            ]);

                            $audit->handle($request->user(), $workOrder, 'maintenance.opened', null, $workOrder->toArray());
                        }
                    } elseif ($asset->status !== AssetStatus::UnderMaintenance && ! $hasOpenBlockingWorkOrders) {
                        $statusGuard->transition($asset, AssetStatus::UnderInspection, new AssetUsageRequest(
                            assetId: (int) $asset->id,
                            usageType: AssetUsageType::AssetStatusChange,
                            targetStatus: AssetStatus::UnderInspection,
                        ));
                    }
                } elseif ($asset->status === AssetStatus::UnderInspection && ! $hasOpenBlockingWorkOrders) {
                    $statusGuard->transition($asset, AssetStatus::ReadyForService, new AssetUsageRequest(
                        assetId: (int) $asset->id,
                        usageType: AssetUsageType::AssetStatusChange,
                        targetStatus: AssetStatus::ReadyForService,
                    ));
                }

                $audit->handle($request->user(), $inspection, 'asset.inspected', null, $inspection->toArray());

                return $inspection;
            });

            if ($request->expectsJson()) {
                return response()->json(['data' => $inspection], 201);
            }

            $resultLabel = ucfirst($validated['result']);

            return back()->with('flash', [
                'tone' => $validated['result'] === 'passed' ? 'success' : 'warning',
                'message' => "Inspection recorded for {$operationalAsset->code} ({$resultLabel}).",
            ]);
        };

        if ($commandId !== null) {
            return $idempotentCommandService->process(
                $request->user(),
                $commandId,
                'asset.inspection.store',
                null,
                $execute,
                $request->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }
}
