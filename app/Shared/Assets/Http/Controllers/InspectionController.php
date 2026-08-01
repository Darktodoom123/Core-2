<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class InspectionController extends Controller
{
    public function store(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetInspect : PermissionName::EquipmentInspect)->value);

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:pre_operation,post_operation,maintenance,safety'],
            'result' => ['required', 'string', 'in:passed,failed,conditional'],
            'checklist' => ['required', 'array', 'min:1'],
            'findings' => ['nullable', 'string', 'max:5000'],
        ]);

        $inspection = DB::transaction(function () use ($request, $operationalAsset, $validated, $audit): Inspection {
            $inspection = $operationalAsset->inspections()->create([
                ...$validated,
                'technician_id' => $request->user()->id,
                'completed_at' => now(),
            ]);

            if ($validated['result'] !== 'passed') {
                $operationalAsset->update(['status' => AssetStatus::UnderInspection]);
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
