<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class InspectionController extends Controller
{
    public function store(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit, OperationalAssetStatusGuard $statusGuard): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetInspect : PermissionName::EquipmentInspect)->value);

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:pre_operation,post_operation,maintenance,safety'],
            'result' => ['required', 'string', 'in:passed,failed,conditional'],
            'checklist' => ['required', 'array', 'min:1'],
            'findings' => ['nullable', 'string', 'max:5000'],
        ]);

        $inspection = DB::transaction(function () use ($request, $operationalAsset, $validated, $audit, $statusGuard): Inspection {
            $asset = OperationalAsset::query()->withTrashed()->lockForUpdate()->findOrFail($operationalAsset->id);
            $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
            Gate::forUser($request->user())->authorize(($isFleet ? PermissionName::FleetInspect : PermissionName::EquipmentInspect)->value);
            $inspection = $asset->inspections()->create([
                ...$validated,
                'technician_id' => $request->user()->id,
                'completed_at' => now(),
            ]);

            if ($validated['result'] !== 'passed') {
                $statusGuard->transition($asset, AssetStatus::UnderInspection, new AssetUsageRequest(
                    assetId: (int) $asset->id,
                    usageType: AssetUsageType::AssetStatusChange,
                    targetStatus: AssetStatus::UnderInspection,
                ));
            }

            $audit->handle($request->user(), $inspection, 'asset.inspected', null, $inspection->toArray());

            return $inspection;
        });

        if ($request->expectsJson()) {
            return response()->json(['data' => $inspection], 201);
        }

        $resultLabel = ucfirst($validated['result']);

        return to_route('home')->with('flash', [
            'tone' => $validated['result'] === 'passed' ? 'success' : 'warning',
            'message' => "Inspection recorded for {$operationalAsset->code} ({$resultLabel}).",
        ]);
    }
}
