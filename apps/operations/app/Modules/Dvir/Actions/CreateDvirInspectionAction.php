<?php

namespace App\Modules\Dvir\Actions;

use App\Modules\Dvir\Enums\DvirCheckStatus;
use App\Modules\Dvir\Http\Requests\Api\V1\CreateDvirInspectionRequest;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionCheck;
use App\Modules\Dvir\Models\DvirInspectionPhoto;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetStatusGuard;
use finfo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class CreateDvirInspectionAction
{
    public function __construct(
        private readonly ?StorageFallbackServiceInterface $storageFallback = null,
        private readonly ?OperationalAssetStatusGuard $statusGuard = null,
        private readonly ?RecordAuditEvent $audit = null,
    ) {}

    /**
     * Persist a completed DVIR with its checks and photos in a single transaction.
     *
     * @return array{inspection: DvirInspection, checks: list<DvirInspectionCheck>, photos: list<DvirInspectionPhoto>}
     *
     * @throws Throwable
     */
    public function execute(
        CreateDvirInspectionRequest $request,
        User $user,
    ): array {
        $validated = $request->validated();

        $checksPayload = $request->checksPayload();
        $photosPayload = $request->photosPayload();

        $inspectionData = $this->buildInspectionAttributes($validated, $user, $checksPayload);

        $batchFolder = (string) Str::uuid();
        $uploadedPhotos = [];
        $preparedPhotos = [];

        try {
            foreach ($photosPayload as $photoItem) {
                $angle = $photoItem['angle'];
                $fileName = $photoItem['file_name'] ?? "{$angle}_".time().'.jpg';
                $stored = $this->storePhotoFile($batchFolder, $angle, $photoItem);

                if ($stored['uploaded_to_disk']) {
                    $uploadedPhotos[] = [
                        'storage_disk' => $stored['storage_disk'],
                        'file_path' => $stored['file_path'],
                    ];
                }

                $preparedPhotos[] = [
                    'angle' => $angle,
                    'storage_disk' => $stored['storage_disk'],
                    'file_path' => $stored['file_path'],
                    'file_name' => $fileName,
                    'file_size_bytes' => $stored['file_size_bytes'],
                    'mime_type' => $stored['mime_type'],
                    'sha256_checksum' => $stored['sha256_checksum'],
                ];
            }

            [$inspection, $checks, $photos] = DB::transaction(function () use ($inspectionData, $checksPayload, $preparedPhotos, $user): array {
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
                        'sort_order' => $check['sort_order'] ?? $index,
                    ]);
                }

                $photos = [];
                foreach ($preparedPhotos as $photoData) {
                    $photos[] = $inspection->photos()->create($photoData);
                }

                $defectChecks = array_values(array_filter(
                    $checksPayload,
                    fn (array $c): bool => in_array($c['status'] ?? '', [DvirCheckStatus::CRITICAL->value, DvirCheckStatus::ATTENTION->value, 'critical', 'attention'], true),
                ));
                $isLockoutRequired = ($inspection->critical_defects_count > 0) || ! empty($defectChecks);

                if ($isLockoutRequired && $inspection->operational_asset_id !== null) {
                    $this->applySafetyLockout((int) $inspection->operational_asset_id, $inspection, $defectChecks, $user);
                }

                return [$inspection, $checks, $photos];
            });
        } catch (Throwable $e) {
            foreach ($uploadedPhotos as $uploaded) {
                try {
                    Storage::disk($uploaded['storage_disk'])->delete($uploaded['file_path']);
                } catch (Throwable) {
                    // Suppress compensation deletion errors to preserve original exception
                }
            }

            throw $e;
        }

        return [
            'inspection' => $inspection->load(['checks', 'photos']),
            'checks' => $checks,
            'photos' => $photos,
        ];
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
        } elseif (! empty($validated['asset_code'])) {
            $asset = OperationalAsset::query()->where('code', $validated['asset_code'])->first();
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

    /**
     * @param  array<string, mixed>  $photoItem
     * @return array{file_path: string, storage_disk: string, file_size_bytes: int, mime_type: string, sha256_checksum: string|null, uploaded_to_disk: bool}
     */
    private function storePhotoFile(string $folder, string $angle, array $photoItem): array
    {
        $storageService = $this->storageFallback ?? app(StorageFallbackServiceInterface::class);
        $desiredDisk = (string) config('filesystems.dvir_disk', 'r2');
        $fallbackDisk = 'public';

        if (! empty($photoItem['base64']) && is_string($photoItem['base64'])) {
            $base64 = $photoItem['base64'];
            if (str_contains($base64, ';base64,')) {
                $parts = explode(';base64,', $base64);
                $base64 = $parts[1] ?? $base64;
            }

            $binary = base64_decode($base64, true);
            if ($binary !== false && strlen($binary) > 0) {
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $detectedMime = (string) $finfo->buffer($binary);
                $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
                $mimeType = in_array($detectedMime, $allowedMimes, true) ? $detectedMime : 'image/jpeg';

                $extension = match ($mimeType) {
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    default => 'jpg',
                };

                $checksum = hash('sha256', $binary);
                $randomSuffix = bin2hex(random_bytes(4));
                $path = "dvir_photos/{$folder}/{$angle}_{$randomSuffix}.{$extension}";

                $actualDisk = $storageService->resolveDisk($desiredDisk, $fallbackDisk);

                try {
                    Storage::disk($actualDisk)->put($path, $binary, ['visibility' => 'public']);
                } catch (Throwable $e) {
                    if ($actualDisk !== $fallbackDisk) {
                        $actualDisk = $fallbackDisk;
                        Storage::disk($actualDisk)->put($path, $binary, ['visibility' => 'public']);
                    } else {
                        throw $e;
                    }
                }

                return [
                    'file_path' => $path,
                    'storage_disk' => $actualDisk,
                    'file_size_bytes' => strlen($binary),
                    'mime_type' => $mimeType,
                    'sha256_checksum' => $checksum,
                    'uploaded_to_disk' => true,
                ];
            }
        }

        $fallbackPath = ! empty($photoItem['uri']) && is_string($photoItem['uri'])
            ? $photoItem['uri']
            : "dvir_photos/{$folder}/{$angle}.jpg";

        $actualDisk = $storageService->resolveDisk($desiredDisk, $fallbackDisk);

        return [
            'file_path' => $fallbackPath,
            'storage_disk' => $actualDisk,
            'file_size_bytes' => isset($photoItem['file_size']) ? (int) $photoItem['file_size'] : 0,
            'mime_type' => 'image/jpeg',
            'sha256_checksum' => null,
            'uploaded_to_disk' => false,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $defectChecks
     */
    private function applySafetyLockout(
        int $operationalAssetId,
        DvirInspection $inspection,
        array $defectChecks,
        User $user,
    ): MaintenanceWorkOrder {
        $asset = OperationalAsset::query()->lockForUpdate()->findOrFail($operationalAssetId);
        $previousStatus = $asset->status;

        $statusGuard = $this->statusGuard ?? app(OperationalAssetStatusGuard::class);
        $statusGuard->transition($asset, AssetStatus::UnderMaintenance, new AssetUsageRequest(
            assetId: (int) $asset->id,
            usageType: AssetUsageType::AssetStatusChange,
            targetStatus: AssetStatus::UnderMaintenance,
        ));

        $defectLines = collect($defectChecks)->map(function (array $check): string {
            $category = $check['category'] ?? 'General';
            $label = $check['label'] ?? 'Unknown Item';
            $status = strtoupper((string) ($check['status'] ?? 'DEFECT'));
            $notes = ! empty($check['notes']) ? ": {$check['notes']}" : '';

            return "• [{$status}] {$label} ({$category}){$notes}";
        })->implode("\n");

        $defectDescription = "Critical DVIR Defect Flagged ({$inspection->reference}):\n"
            .($defectLines ?: 'Critical defects flagged during inspection walkaround.');

        if (! empty($inspection->remarks)) {
            $defectDescription .= "\nRemarks: {$inspection->remarks}";
        }

        $workOrder = $asset->maintenanceWorkOrders()->create([
            'technician_id' => $user->id,
            'status' => 'pending',
            'defect' => $defectDescription,
            'dispatch_blocking' => true,
            'scheduled_at' => now(),
            'remarks' => "Automatic lockout triggered by DVIR inspection #{$inspection->reference}",
        ]);

        $auditService = $this->audit ?? app(RecordAuditEvent::class);
        $auditService->handle(
            actor: $user,
            subject: $asset,
            action: 'asset.safety_lockout_dvir',
            before: ['status' => $previousStatus->value],
            after: [
                'status' => AssetStatus::UnderMaintenance->value,
                'dvir_id' => $inspection->id,
                'dvir_reference' => $inspection->reference,
                'maintenance_work_order_id' => $workOrder->id,
                'critical_defects_count' => $inspection->critical_defects_count,
            ],
            reason: "Critical DVIR defect flagged during inspection #{$inspection->reference}",
        );

        $auditService->handle(
            actor: $user,
            subject: $workOrder,
            action: 'maintenance.opened',
            before: null,
            after: $workOrder->toArray(),
            reason: "Automatic dispatch-blocking work order generated from DVIR #{$inspection->reference}",
        );

        return $workOrder;
    }
}
