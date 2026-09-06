<?php

namespace App\Modules\Dvir\Actions;

use App\Modules\Dvir\Enums\DvirCheckStatus;
use App\Modules\Dvir\Http\Requests\Api\V1\CreateDvirInspectionRequest;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionCheck;
use App\Modules\Dvir\Models\DvirInspectionPhoto;
use App\Platform\Identity\Models\User;
use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Shared\Assets\Models\OperationalAsset;
use finfo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CreateDvirInspectionAction
{
    public function __construct(
        private readonly ?StorageFallbackServiceInterface $storageFallback = null,
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

        [$inspection, $checks, $photos] = DB::transaction(function () use ($inspectionData, $checksPayload, $photosPayload): array {
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
            foreach ($photosPayload as $photoItem) {
                $angle = $photoItem['angle'];
                $fileName = $photoItem['file_name'] ?? "{$angle}_".time().'.jpg';
                $stored = $this->storePhotoFile((int) $inspection->id, $angle, $photoItem);

                $photos[] = $inspection->photos()->create([
                    'angle' => $angle,
                    'storage_disk' => $stored['storage_disk'],
                    'file_path' => $stored['file_path'],
                    'file_name' => $fileName,
                    'file_size_bytes' => $stored['file_size_bytes'],
                    'mime_type' => $stored['mime_type'],
                    'sha256_checksum' => $stored['sha256_checksum'],
                ]);
            }

            return [$inspection, $checks, $photos];
        });

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
     * @return array{file_path: string, storage_disk: string, file_size_bytes: int, mime_type: string, sha256_checksum: string|null}
     */
    private function storePhotoFile(int $inspectionId, string $angle, array $photoItem): array
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
                $path = "dvir_photos/{$inspectionId}/{$angle}_{$randomSuffix}.{$extension}";

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
                ];
            }
        }

        $fallbackPath = ! empty($photoItem['uri']) && is_string($photoItem['uri'])
            ? $photoItem['uri']
            : "dvir_photos/{$inspectionId}/{$angle}.jpg";

        $actualDisk = $storageService->resolveDisk($desiredDisk, $fallbackDisk);

        return [
            'file_path' => $fallbackPath,
            'storage_disk' => $actualDisk,
            'file_size_bytes' => isset($photoItem['file_size']) ? (int) $photoItem['file_size'] : 0,
            'mime_type' => 'image/jpeg',
            'sha256_checksum' => null,
        ];
    }
}
