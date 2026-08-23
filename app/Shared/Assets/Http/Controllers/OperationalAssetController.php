<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class OperationalAssetController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', OperationalAsset::class);

        return response()->json(['data' => OperationalAsset::query()->visibleTo(request()->user())->with(['maintenanceWorkOrders', 'inspections'])->orderBy('code')->paginate(50)]);
    }

    public function store(): never
    {
        abort(403, 'Asset registration is managed by Core 3.');
    }

    public function status(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit, OperationalAssetStatusGuard $statusGuard): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(AssetStatus::class)],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $next = AssetStatus::from($validated['status']);
        $operationalAsset = DB::transaction(function () use ($request, $operationalAsset, $audit, $statusGuard, $next, $validated): OperationalAsset {
            $asset = OperationalAsset::query()->withTrashed()->lockForUpdate()->findOrFail($operationalAsset->id);
            $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
            $allowed = $request->user()->can(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);
            if (! $allowed) {
                abort(403);
            }
            $before = ['status' => $asset->status->value];
            $statusGuard->transition($asset, $next, new AssetUsageRequest(
                assetId: (int) $asset->id,
                usageType: AssetUsageType::AssetStatusChange,
                targetStatus: $next,
            ));
            $audit->handle($request->user(), $asset, 'asset.status_updated', $before, ['status' => $next->value], $validated['reason']);

            return $asset;
        });

        if ($request->expectsJson()) {
            return response()->json(['data' => $operationalAsset->refresh()]);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Asset {$operationalAsset->code} status updated to {$next->label()}.",
        ]);
    }
}
