<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\AssetStatus;
use App\Enums\PermissionName;
use App\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class OperationalAssetController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', OperationalAsset::class);

        return response()->json(['data' => OperationalAsset::query()->visibleTo(request()->user())->with(['maintenanceWorkOrders', 'inspections'])->orderBy('code')->paginate(50)]);
    }

    public function store(Request $request, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64', 'unique:operational_assets,code'],
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['required', 'string', 'in:truck,vehicle,crane,equipment'],
            'subtype' => ['nullable', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'model' => ['nullable', 'string', 'max:255'],
            'rated_capacity' => ['nullable', 'numeric', 'min:0'],
            'capacity_unit' => ['nullable', 'string', 'max:64'],
            'meter_type' => ['nullable', 'string', 'max:64'],
            'meter_value' => ['nullable', 'numeric', 'min:0'],
            'location' => ['nullable', 'string', 'max:255'],
            'specifications' => ['nullable', 'array'],
        ]);

        $permission = in_array($validated['kind'], ['truck', 'vehicle'], true) ? PermissionName::FleetRegister : PermissionName::EquipmentRegister;
        Gate::authorize($permission->value);

        $asset = OperationalAsset::query()->create([...$validated, 'status' => AssetStatus::Available]);
        $audit->handle($request->user(), $asset, 'asset.registered', null, $asset->toArray());

        if ($request->expectsJson()) {
            return response()->json(['data' => $asset], 201);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Asset {$asset->code} ({$asset->name}) was registered.",
        ]);
    }

    public function status(Request $request, OperationalAsset $operationalAsset, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(AssetStatus::class)],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $next = AssetStatus::from($validated['status']);
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        $allowed = $request->user()->can(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);

        if (! $allowed) {
            abort(403);
        }

        if (in_array($next, [AssetStatus::ReadyForService, AssetStatus::Available], true)) {
            $hasBlockingMaintenance = $operationalAsset->maintenanceWorkOrders()->where('dispatch_blocking', true)->whereNull('released_at')->exists();
            $hasPassingInspection = $operationalAsset->inspections()->where('result', 'passed')->whereNotNull('completed_at')->exists();

            if ($hasBlockingMaintenance || ! $hasPassingInspection) {
                throw ValidationException::withMessages([
                    'status' => 'A completed passing inspection and released blocking maintenance orders are required before setting status to ready or available.',
                ]);
            }
        }

        $before = ['status' => $operationalAsset->status->value];
        $operationalAsset->update(['status' => $next]);
        $audit->handle($request->user(), $operationalAsset, 'asset.status_updated', $before, ['status' => $next->value], $validated['reason']);

        if ($request->expectsJson()) {
            return response()->json(['data' => $operationalAsset->refresh()]);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Asset {$operationalAsset->code} status updated to {$next->label()}.",
        ]);
    }
}
