<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

final class MaintenanceWorkOrderController extends Controller
{
    public function store(
        Request $request,
        OperationalAsset $operationalAsset,
        RecordAuditEvent $audit,
        OperationalAssetStatusGuard $statusGuard,
        IdempotentCommandService $idempotentCommandService,
    ): Response {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

        $validated = $request->validate([
            'defect' => ['required', 'string', 'max:5000'],
            'dispatch_blocking' => ['required', 'boolean'],
            'scheduled_at' => ['nullable', 'date'],
            'next_due_at' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $commandId = $idempotentCommandService->resolveCommandId($request);

        $execute = function () use ($request, $operationalAsset, $validated, $audit, $statusGuard): Response {
            $work = DB::transaction(function () use ($request, $operationalAsset, $validated, $audit, $statusGuard): MaintenanceWorkOrder {
                $asset = OperationalAsset::query()->withTrashed()->lockForUpdate()->findOrFail($operationalAsset->id);
                $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
                Gate::forUser($request->user())->authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);
                $work = $asset->maintenanceWorkOrders()->create([
                    ...$validated,
                    'technician_id' => $request->user()->id,
                    'status' => AssetStatus::UnderMaintenance->value,
                ]);
                $statusGuard->transition($asset, AssetStatus::UnderMaintenance, new AssetUsageRequest(
                    assetId: (int) $asset->id,
                    usageType: AssetUsageType::AssetStatusChange,
                    targetStatus: AssetStatus::UnderMaintenance,
                ));
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
        };

        if ($commandId !== null) {
            return $idempotentCommandService->process(
                $request->user(),
                $commandId,
                'maintenance.store',
                null,
                $execute,
                $request->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }

    public function complete(
        Request $request,
        MaintenanceWorkOrder $maintenanceWorkOrder,
        RecordAuditEvent $audit,
        IdempotentCommandService $idempotentCommandService,
    ): Response {
        $asset = $maintenanceWorkOrder->asset;
        $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

        $validated = $request->validate([
            'completed_at' => ['nullable', 'date'],
            'work_performed' => ['nullable', 'array'],
            'parts' => ['sometimes', 'array'],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $commandId = $idempotentCommandService->resolveCommandId($request);

        $execute = function () use ($request, $maintenanceWorkOrder, $validated, $audit): Response {
            $completedOrder = DB::transaction(function () use ($request, $maintenanceWorkOrder, $validated, $audit): MaintenanceWorkOrder {
                $work = MaintenanceWorkOrder::query()->lockForUpdate()->findOrFail($maintenanceWorkOrder->id);
                $asset = OperationalAsset::query()->withTrashed()->lockForUpdate()->findOrFail($work->operational_asset_id);
                $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
                Gate::forUser($request->user())->authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

                if ($work->released_at !== null) {
                    throw ValidationException::withMessages([
                        'status' => 'Cannot record repair completion on an already released maintenance work order.',
                    ]);
                }

                if ($work->completed_at !== null) {
                    if (isset($validated['completed_at'])) {
                        $requestedCompletedAt = Carbon::parse($validated['completed_at']);
                        if ($requestedCompletedAt->timestamp !== $work->completed_at->timestamp) {
                            throw ValidationException::withMessages([
                                'completed_at' => 'Authoritative repair completion timestamp has already been recorded and cannot be altered.',
                            ]);
                        }
                    }
                    $completedAt = $work->completed_at;
                } else {
                    $completedAt = isset($validated['completed_at'])
                        ? Carbon::parse($validated['completed_at'])
                        : now();

                    if ($completedAt->isBefore($work->created_at)) {
                        throw ValidationException::withMessages([
                            'completed_at' => 'Repair completion time cannot be earlier than work order creation.',
                        ]);
                    }

                    if ($completedAt->isAfter(now()->addMinutes(5))) {
                        throw ValidationException::withMessages([
                            'completed_at' => 'Repair completion time cannot be in the future.',
                        ]);
                    }
                }

                $updateData = [
                    'completed_at' => $completedAt,
                    'status' => 'repair_completed',
                ];

                if (isset($validated['work_performed'])) {
                    $updateData['work_performed'] = $validated['work_performed'];
                }
                if (isset($validated['parts'])) {
                    $updateData['parts'] = $validated['parts'];
                }
                if (isset($validated['remarks'])) {
                    $updateData['remarks'] = $validated['remarks'];
                }

                $work->update($updateData);

                $audit->handle($request->user(), $work, 'maintenance.completed', null, $work->toArray());

                return $work;
            });

            if ($request->expectsJson()) {
                return response()->json(['data' => $completedOrder->refresh()]);
            }

            return back()->with('flash', [
                'tone' => 'positive',
                'message' => 'Maintenance repair completed.',
            ]);
        };

        if ($commandId !== null) {
            return $idempotentCommandService->process(
                $request->user(),
                $commandId,
                'maintenance.complete',
                null,
                $execute,
                $request->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }

    public function release(
        Request $request,
        MaintenanceWorkOrder $maintenanceWorkOrder,
        RecordAuditEvent $audit,
        OperationalAssetStatusGuard $statusGuard,
        IdempotentCommandService $idempotentCommandService,
    ): Response {
        $asset = $maintenanceWorkOrder->asset;
        $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

        $validated = $request->validate([
            'work_performed' => ['required', 'array', 'min:1'],
            'parts' => ['sometimes', 'array'],
            'release_checklist' => ['nullable', 'array'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'next_due_at' => ['nullable', 'date'],
            'completed_at' => ['nullable', 'date'],
            'managerial_override' => ['sometimes', 'boolean'],
            'override_reason' => ['required_if:managerial_override,true', 'nullable', 'string', 'max:2000'],
        ]);

        $commandId = $idempotentCommandService->resolveCommandId($request);

        $execute = function () use ($request, $maintenanceWorkOrder, $asset, $validated, $audit, $statusGuard): Response {
            $releasedOrder = DB::transaction(function () use ($request, $maintenanceWorkOrder, $validated, $audit, $statusGuard): MaintenanceWorkOrder {
                $work = MaintenanceWorkOrder::query()->lockForUpdate()->findOrFail($maintenanceWorkOrder->id);
                $asset = OperationalAsset::query()->withTrashed()->lockForUpdate()->findOrFail($work->operational_asset_id);
                $isFleet = in_array($asset->kind, ['truck', 'vehicle'], true);
                Gate::forUser($request->user())->authorize(($isFleet ? PermissionName::FleetMaintain : PermissionName::EquipmentMaintain)->value);

                $statusRecheckCanRestore = in_array($asset->status, [
                    AssetStatus::UnderInspection,
                    AssetStatus::UnderMaintenance,
                    AssetStatus::AwaitingParts,
                ], true);
                if (! $asset->status->dispatchable() && ! $statusRecheckCanRestore) {
                    throw ValidationException::withMessages([
                        'status' => 'The asset is not currently dispatchable.',
                    ]);
                }

                $isManagerOverride = (bool) ($validated['managerial_override'] ?? false);

                if ($work->dispatch_blocking && ! $isManagerOverride) {
                    if ($work->completed_at === null) {
                        throw ValidationException::withMessages([
                            'completed_at' => 'A persisted repair completion record is required before releasing a blocking maintenance order.',
                            'inspection' => 'A passing inspection completed after the repair is required before releasing a blocking maintenance order.',
                        ]);
                    }

                    if (isset($validated['completed_at']) && Carbon::parse($validated['completed_at'])->isBefore($work->completed_at)) {
                        throw ValidationException::withMessages([
                            'completed_at' => 'Release completed_at cannot substitute an earlier completion time than recorded repair completion.',
                        ]);
                    }
                }

                $repairThreshold = $work->completed_at !== null
                    ? Carbon::parse($work->completed_at)
                    : (isset($validated['completed_at']) ? Carbon::parse($validated['completed_at']) : $work->created_at);

                $latestPassingLegacy = $asset->inspections()
                    ->where('result', 'passed')
                    ->whereIn('type', ['maintenance', 'safety', 'post_repair'])
                    ->where('completed_at', '>=', $repairThreshold)
                    ->latest('completed_at')
                    ->latest('id')
                    ->first();

                $hasPassingInspection = $latestPassingLegacy !== null;
                $hasSubsequentDefect = false;
                if ($latestPassingLegacy !== null) {
                    $passingCarbon = Carbon::parse($latestPassingLegacy->completed_at);
                    $hasSubsequentLegacyDefect = $asset->inspections()
                        ->where('result', '!=', 'passed')
                        ->where(function ($q) use ($passingCarbon, $latestPassingLegacy): void {
                            $q->where('completed_at', '>', $passingCarbon);
                            $q->orWhere(function ($q2) use ($latestPassingLegacy): void {
                                $q2->where('completed_at', $latestPassingLegacy->completed_at)
                                    ->where('id', '>', $latestPassingLegacy->id);
                            });
                        })
                        ->exists();

                    $hasSubsequentDvirDefect = $asset->dvirInspections()
                        ->where(function ($q): void {
                            $q->where('has_defects', true)->orWhere('critical_defects_count', '>', 0);
                        })
                        ->where(function ($q) use ($passingCarbon): void {
                            $q->where('completed_at', '>', $passingCarbon);
                        })
                        ->exists();

                    $hasSubsequentDefect = $hasSubsequentLegacyDefect || $hasSubsequentDvirDefect;
                }

                $isManagerOverride = (bool) ($validated['managerial_override'] ?? false);

                if (! $hasPassingInspection && ! $isManagerOverride) {
                    throw ValidationException::withMessages([
                        'inspection' => 'A passing inspection completed after the repair is required before releasing a blocking maintenance order.',
                    ]);
                }

                if ($hasSubsequentDefect && ! $isManagerOverride) {
                    throw ValidationException::withMessages([
                        'inspection' => 'A subsequent inspection reported defects on this asset after the post-repair inspection. A new passing inspection is required before release.',
                    ]);
                }

                $updateData = [
                    'work_performed' => $validated['work_performed'],
                    'parts' => $validated['parts'] ?? [],
                    'status' => AssetStatus::ReadyForService->value,
                    'dispatch_blocking' => false,
                    'completed_at' => $work->completed_at ?? (isset($validated['completed_at']) ? Carbon::parse($validated['completed_at']) : now()),
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

                $work->update($updateData);

                if (! $asset->maintenanceWorkOrders()->where('dispatch_blocking', true)->whereNull('released_at')->exists() && ! $hasSubsequentDefect) {
                    $statusGuard->transition($asset, AssetStatus::ReadyForService, new AssetUsageRequest(
                        assetId: (int) $asset->id,
                        usageType: AssetUsageType::AssetStatusChange,
                        targetStatus: AssetStatus::ReadyForService,
                        source: $isManagerOverride ? new AssetUsageSource('managerial_override', (int) $work->id) : null,
                    ));
                }

                $auditPayload = [
                    'status' => AssetStatus::ReadyForService->value,
                    'released_at' => now()->toIso8601String(),
                    'release_verified_by' => $request->user()->id,
                ];
                if ($isManagerOverride) {
                    $auditPayload['managerial_override'] = true;
                    $auditPayload['override_reason'] = $validated['override_reason'] ?? null;
                }

                $audit->handle($request->user(), $work, 'maintenance.released', null, $auditPayload);

                return $work;
            });

            if ($request->expectsJson()) {
                return response()->json(['data' => $releasedOrder->refresh()]);
            }

            return to_route('home')->with('flash', [
                'tone' => 'success',
                'message' => "Maintenance work order for {$asset->code} released and verified.",
            ]);
        };

        if ($commandId !== null) {
            return $idempotentCommandService->process(
                $request->user(),
                $commandId,
                'maintenance.release',
                null,
                $execute,
                $request->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }
}
