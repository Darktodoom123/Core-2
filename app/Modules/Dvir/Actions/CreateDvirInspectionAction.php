<?php

namespace App\Modules\Dvir\Actions;

use App\Modules\Dvir\Enums\DvirCheckStatus;
use App\Modules\Dvir\Http\Requests\Api\V1\CreateDvirInspectionRequest;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionCheck;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Facades\DB;
use Throwable;

class CreateDvirInspectionAction
{
    /**
     * Persist a completed DVIR with its checks in a single transaction.
     *
     * @return array{inspection: DvirInspection, checks: list<DvirInspectionCheck>}
     *
     * @throws Throwable
     */
    public function execute(
        CreateDvirInspectionRequest $request,
        User $user,
    ): array {
        $validated = $request->validated();

        $checksPayload = $request->checksPayload();

        $inspectionData = $this->buildInspectionAttributes($validated, $user, $checksPayload);

        [$inspection, $checks] = DB::transaction(function () use ($inspectionData, $checksPayload): array {
            $inspection = DvirInspection::query()->create($inspectionData);

            $checks = [];
            foreach ($checksPayload as $index => $check) {
                $checks[] = $inspection->checks()->create([
                    'external_id' => $check['id'] ?? null,
                    'category' => $check['category'],
                    'label' => $check['label'],
                    'status' => DvirCheckStatus::from($check['status']),
                    'status_label' => $check['status_label'] ?? null,
                    'notes' => $check['notes'] ?? null,
                    'sort_order' => $index,
                ]);
            }

            return [$inspection, $checks];
        });

        return ['inspection' => $inspection->load('checks'), 'checks' => $checks];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  list<array<string, mixed>>  $checksPayload
     * @return array<string, mixed>
     */
    private function buildInspectionAttributes(array $validated, User $user, array $checksPayload): array
    {
        $asset = null;
        if (isset($validated['operational_asset_id'])) {
            $asset = OperationalAsset::query()->whereKey((int) $validated['operational_asset_id'])->first();
        }

        $statuses = collect($checksPayload)->pluck('status');
        $criticalDefectsCount = $statuses->filter(
            fn (string $status): bool => $status === DvirCheckStatus::CRITICAL->value,
        )->count();
        // The defect flag is derived server-side so it can never contradict the submitted checks.
        $hasDefects = (bool) $validated['has_defects']
            || $statuses->contains(fn (string $status): bool => DvirCheckStatus::from($status)->isDefect());

        $operationalAssetId = $asset !== null ? $asset->getKey() : null;
        // Snapshot asset identifiers so historical records survive asset renames or deletions.
        $assetCode = $asset !== null ? $asset->code : ($validated['asset_code'] ?? null);
        $assetName = $asset !== null ? $asset->name : ($validated['asset_name'] ?? null);

        return [
            'user_id' => $user->id,
            'operational_asset_id' => $operationalAssetId,
            'dispatch_job_id' => $validated['dispatch_job_id'] ?? null,
            'inspection_type' => $validated['inspection_type'],
            'asset_code' => $assetCode,
            'asset_name' => $assetName,
            'inspector_name' => $validated['inspector_name'] ?? $user->name,
            'starting_odometer_km' => $validated['starting_odometer_km'] ?? null,
            'ending_odometer_km' => $validated['ending_odometer_km'] ?? null,
            'engine_hours' => $validated['engine_hours'] ?? null,
            'has_defects' => $hasDefects,
            'critical_defects_count' => $criticalDefectsCount,
            'signature_captured' => (bool) $validated['signature_captured'],
            'remarks' => $validated['remarks'] ?? null,
            'completed_at' => $validated['completed_at'] ?? now(),
        ];
    }
}
