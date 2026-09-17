<?php

namespace App\Modules\Sales\Actions;

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesDeliveryEvidence;
use App\Modules\Sales\Models\SalesOrder;
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

final class RecordSalesDeliveryEvidence
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly ?StorageFallbackServiceInterface $storageFallback = null,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function handle(SalesOrder $order, User $actor, array $attributes): SalesDeliveryEvidence
    {
        $createdFiles = [];
        $signaturePath = null;
        $storedPhotos = [];

        try {
            // Stage signature outside DB transaction
            if (! empty($attributes['signature_base64']) && is_string($attributes['signature_base64'])) {
                $savedSignature = $this->storeBase64File(
                    'sales_evidence/signatures',
                    "order_{$order->id}_sig",
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
                            "sales_evidence/photos/{$order->id}",
                            "order_{$order->id}_photo_{$idx}",
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
            return DB::transaction(function () use ($order, $actor, $attributes, $signaturePath, $storedPhotos): SalesDeliveryEvidence {
                /** @var SalesOrder $locked */
                $locked = SalesOrder::query()->lockForUpdate()->findOrFail($order->id);

                if ($locked->status !== SalesOrderStatus::Confirmed) {
                    throw ValidationException::withMessages([
                        'status' => 'Only confirmed sales orders can accept delivery evidence.',
                    ]);
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
                                    ->where('source_type', 'sales_order')
                                    ->where('source_id', $locked->id);
                            });
                    })->first();
                } else {
                    $attempt = $attemptQuery->whereIn('handoff_id', function ($sub) use ($locked) {
                        $sub->select('id')->from('dispatch_handoffs')
                            ->where('source_type', 'sales_order')
                            ->where('source_id', $locked->id);
                    })->first();
                }

                $assetId = isset($attributes['operational_asset_id']) ? (int) $attributes['operational_asset_id'] : null;

                /** @var SalesDeliveryEvidence $evidence */
                $evidence = SalesDeliveryEvidence::query()->create([
                    'workspace_key' => $attempt->workspace_key ?? 'operations',
                    'sales_order_id' => $locked->id,
                    'dispatch_job_id' => $targetDispatchJobId,
                    'dispatch_execution_attempt_id' => $attempt?->id,
                    'operational_asset_id' => $assetId,
                    'submitted_by' => $actor->id,
                    'verified_vin' => (string) ($attributes['verified_vin'] ?? ''),
                    'accessories_checked' => $attributes['accessories_checked'] ?? [],
                    'delivery_notes' => $attributes['delivery_notes'] ?? null,
                    'photos' => $storedPhotos,
                    'signature_path' => $signaturePath,
                    'signee_name' => (string) ($attributes['signee_name'] ?? 'Client Representative'),
                    'signee_role' => (string) ($attributes['signee_role'] ?? 'Authorized Receiving Representative'),
                    'submitted_at' => now(),
                ]);

                // If linked dispatch job exists and is in working status, complete execution attempt and job
                if ($targetDispatchJobId !== null) {
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
                    'sales_order.delivery_evidence_recorded',
                    null,
                    $evidence->toArray(),
                );

                return $evidence->fresh(['submitter', 'order', 'dispatchJob', 'asset', 'attempt']);
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
