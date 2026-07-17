<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\AssetStatus;
use App\Enums\PermissionName;
use App\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class OperationalAssetController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', OperationalAsset::class);

        return response()->json(['data' => OperationalAsset::query()->visibleTo(request()->user())->with('maintenanceWorkOrders')->orderBy('code')->paginate(50)]);
    }

    public function store(Request $request, RecordAuditEvent $audit): JsonResponse
    {
        $validated = $request->validate(['code' => ['required', 'string', 'max:64', 'unique:operational_assets,code'], 'name' => ['required', 'string', 'max:255'], 'kind' => ['required', 'string', 'in:truck,vehicle,crane,equipment'], 'subtype' => ['nullable', 'string', 'max:255'], 'specifications' => ['nullable', 'array']]);
        $permission = in_array($validated['kind'], ['truck', 'vehicle'], true) ? PermissionName::FleetRegister : PermissionName::EquipmentRegister;
        Gate::authorize($permission->value);
        $asset = OperationalAsset::query()->create([...$validated, 'status' => AssetStatus::Available]);
        $audit->handle($request->user(), $asset, 'asset.registered', null, $asset->toArray());

        return response()->json(['data' => $asset], 201);
    }

    public function status(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit): JsonResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::enum(AssetStatus::class)], 'reason' => ['required', 'string', 'max:2000']]);
        $next = AssetStatus::from($validated['status']);
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        $allowed = $request->user()->can(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);
        if (! $allowed) {
            abort(403);
        }
        if ($next === AssetStatus::ReadyForService && ($operationalAsset->maintenanceWorkOrders()->where('dispatch_blocking', true)->whereNull('released_at')->exists() || ! $operationalAsset->inspections()->where('result', 'passed')->whereNotNull('completed_at')->exists())) {
            throw ValidationException::withMessages(['status' => 'A passing completed inspection and released blocking work orders are required.']);
        }
        $before = ['status' => $operationalAsset->status->value];
        $operationalAsset->update(['status' => $next]);
        $audit->handle($request->user(), $operationalAsset, 'asset.status_updated', $before, ['status' => $next->value], $validated['reason']);

        return response()->json(['data' => $operationalAsset->refresh()]);
    }
}
