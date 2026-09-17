<?php

namespace App\Modules\Rental\Actions;

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalHandoverEvidence;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use Exception;
use finfo;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

final class RecordRentalHandoverEvidence
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly ?StorageFallbackServiceInterface $storageFallback = null,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(RentalReservation $reservation, User $actor, array $attributes): RentalHandoverEvidence
    {
        $createdFiles = [];
        $signaturePath = null;
        $storedPhotos = [];

        try {
            // Stage signature outside DB transaction
            if (! empty($attributes['signature_base64']) && is_string($attributes['signature_base64'])) {
                $savedSignature = $this->storeBase64File(
                    'rental_evidence/signatures',
                    "res_{$reservation->id}_sig",
                    $attributes['signature_base64'],
                );
                if ($savedSignature !== null) {
                    $signaturePath = $savedSignature['path'];
                    $createdFiles[] = $savedSignature;
                }
            }

            // Stage photos outside DB transaction
            if (! empty($attributes['photos']) && is_array($attributes['photos'])) {
                foreach ($attributes['photos'] as $idx => $photo) {
                    if (is_array($photo) && ! empty($photo['base64']) && is_string($photo['base64'])) {
                        $savedPhoto = $this->storeBase64File(
                            "rental_evidence/photos/{$reservation->id}",
                            "res_{$reservation->id}_photo_{$idx}",
                            $photo['base64'],
                        );
                        if ($savedPhoto !== null) {
                            $createdFiles[] = $savedPhoto;
                            $storedPhotos[] = [
                                'file_path' => $savedPhoto['path'],
                                'storage_disk' => $savedPhoto['disk'],
                                'url' => Storage::disk($savedPhoto['disk'])->url($savedPhoto['path']),
                                'mime_type' => $savedPhoto['mime_type'],
                                'file_size_bytes' => $savedPhoto['file_size_bytes'],
                                'label' => $photo['label'] ?? 'Photo '.($idx + 1),
                            ];
                        }
                    } elseif (is_array($photo) && ! empty($photo['file_path'])) {
                        $storedPhotos[] = $photo;
                    }
                }
            }

            // Perform atomic database persistence
            return DB::transaction(function () use ($reservation, $actor, $attributes, $signaturePath, $storedPhotos): RentalHandoverEvidence {
                /** @var RentalReservation $locked */
                $locked = RentalReservation::query()->lockForUpdate()->findOrFail($reservation->id);

                $handoverType = (string) ($attributes['handover_type'] ?? 'checkout');
                if ($handoverType === 'checkout' && $locked->status !== RentalReservationStatus::Reserved) {
                    throw ValidationException::withMessages([
                        'status' => 'Only reserved rentals can accept checkout handover evidence.',
                    ]);
                }
                if ($handoverType === 'return' && $locked->status !== RentalReservationStatus::CheckedOut) {
                    throw ValidationException::withMessages([
                        'status' => 'Only checked-out rentals can accept return handover evidence.',
                    ]);
                }

                // Resolve asset ID and validate multi-asset constraints
                $assetId = isset($attributes['operational_asset_id']) ? (int) $attributes['operational_asset_id'] : null;
                $items = $locked->items()->get();
                if ($assetId === null) {
                    if ($items->count() === 1) {
                        $assetId = (int) $items->first()->operational_asset_id;
                    } elseif ($items->count() > 1) {
                        throw ValidationException::withMessages([
                            'operational_asset_id' => 'This rental reservation includes multiple equipment units. Please specify the operational_asset_id being handed over.',
                        ]);
                    }
                }

                $targetDispatchJobId = isset($attributes['dispatch_job_id']) ? (int) $attributes['dispatch_job_id'] : $locked->dispatch_job_id;

                // Locate active execution attempt
                $attempt = null;
                $attemptQuery = DispatchExecutionAttempt::query()
                    ->whereNull('archived_at')
                    ->orderByDesc('attempt_number')
                    ->lockForUpdate();

                if ($targetDispatchJobId !== null) {
                    $attempt = $attemptQuery->where(function ($q) use ($targetDispatchJobId, $locked) {
                        $q->where('legacy_dispatch_job_id', $targetDispatchJobId)
                            ->orWhereIn('handoff_id', function ($sub) use ($targetDispatchJobId, $locked) {
                                $sub->select('id')->from('dispatch_handoffs')
                                    ->where('legacy_dispatch_job_id', $targetDispatchJobId)
                                    ->where('source_type', 'rental_reservation')
                                    ->where('source_id', $locked->id);
                            });
                    })->first();
                } else {
                    $attempt = $attemptQuery->whereIn('handoff_id', function ($sub) use ($locked) {
                        $sub->select('id')->from('dispatch_handoffs')
                            ->where('source_type', 'rental_reservation')
                            ->where('source_id', $locked->id);
                    })->first();
                }

                /** @var RentalHandoverEvidence $evidence */
                $evidence = RentalHandoverEvidence::query()->create([
                    'workspace_key' => $attempt->workspace_key ?? 'operations',
                    'rental_reservation_id' => $locked->id,
                    'dispatch_job_id' => $targetDispatchJobId,
                    'dispatch_execution_attempt_id' => $attempt?->id,
                    'operational_asset_id' => $assetId,
                    'submitted_by' => $actor->id,
                    'handover_type' => $handoverType,
                    'hour_meter' => (float) ($attributes['hour_meter'] ?? 0.0),
                    'fuel_percent' => (int) ($attributes['fuel_percent'] ?? 100),
                    'condition_assessment' => $attributes['condition_assessment'] ?? null,
                    'condition_notes' => $attributes['condition_notes'] ?? null,
                    'damage_noted' => (bool) ($attributes['damage_noted'] ?? false),
                    'damage_notes' => $attributes['damage_notes'] ?? null,
                    'photos' => $storedPhotos,
                    'signature_path' => $signaturePath,
                    'signee_name' => (string) ($attributes['signee_name'] ?? 'Client Representative'),
                    'signee_role' => $attributes['signee_role'] ?? null,
                    'submitted_at' => now(),
                ]);

                // Verify whether all reserved assets now have evidence for this handover type
                $requiredAssetIds = $items->pluck('operational_asset_id')->filter()->map(fn ($id) => (int) $id)->unique();
                $evidencedAssetIds = RentalHandoverEvidence::query()
                    ->where('rental_reservation_id', $locked->id)
                    ->where('handover_type', $handoverType)
                    ->whereNotNull('operational_asset_id')
                    ->pluck('operational_asset_id')
                    ->map(fn ($id) => (int) $id)
                    ->unique();
                $allAssetsEvidenced = $requiredAssetIds->isEmpty() || $requiredAssetIds->diff($evidencedAssetIds)->isEmpty();

                // Only complete the execution attempt and job if ALL assets have evidence and attempt is working/arrived
                if ($targetDispatchJobId !== null && $allAssetsEvidenced) {
                    /** @var DispatchJob|null $job */
                    $job = DispatchJob::query()->lockForUpdate()->find($targetDispatchJobId);
                    if ($job !== null && in_array($job->status, [DispatchStatus::Working, DispatchStatus::Arrived], true)) {
                        $job->update([
                            'status' => DispatchStatus::Completed,
                            'version' => $job->version + 1,
                        ]);
                    }

                    if ($attempt instanceof DispatchExecutionAttempt && in_array($attempt->status, [DispatchAttemptStatus::Working, DispatchAttemptStatus::Arrived], true)) {
                        $attempt->update([
                            'status' => DispatchAttemptStatus::Completed,
                            'version' => $attempt->version + 1,
                        ]);
                    }
                }

                $this->audit->handle(
                    $actor,
                    $locked,
                    'rental_reservation.handover_evidence_recorded',
                    null,
                    $evidence->toArray(),
                );

                return $evidence->fresh(['submitter', 'reservation', 'dispatchJob', 'asset', 'attempt']);
            });
        } catch (Throwable $e) {
            // Compensation handler: cleanup staged files on failure
            foreach ($createdFiles as $file) {
                try {
                    Storage::disk($file['disk'])->delete($file['path']);
                } catch (Throwable) {
                    // Swallow deletion error to preserve original exception
                }
            }

            throw $e;
        }
    }

    /**
     * @return array{path: string, disk: string, mime_type: string, file_size_bytes: int}|null
     */
    private function storeBase64File(string $directory, string $filenamePrefix, string $base64Data): ?array
    {
        $base64 = $base64Data;
        if (str_contains($base64, ';base64,')) {
            $parts = explode(';base64,', $base64);
            $base64 = $parts[1] ?? $base64;
        }

        $binary = base64_decode($base64, true);
        if ($binary === false || strlen($binary) === 0) {
            return null;
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedMime = (string) $finfo->buffer($binary);
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/svg+xml'];
        if (! in_array($detectedMime, $allowedMimes, true)) {
            return null;
        }
        $mimeType = $detectedMime;

        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            'image/svg+xml', 'application/svg+xml' => 'svg',
            default => 'png',
        };

        $storageService = $this->storageFallback ?? app(StorageFallbackServiceInterface::class);
        $desiredDisk = (string) config('filesystems.attachments_disk', 'public');
        $fallbackDisk = 'public';
        $actualDisk = $storageService->resolveDisk($desiredDisk, $fallbackDisk);

        $randomSuffix = Str::random(8);
        $path = "{$directory}/{$filenamePrefix}_{$randomSuffix}.{$extension}";

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
            'path' => $path,
            'disk' => $actualDisk,
            'mime_type' => $mimeType,
            'file_size_bytes' => strlen($binary),
        ];
    }
}
