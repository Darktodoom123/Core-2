<?php

namespace App\Platform\Attachments\Actions;

use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class UploadAttachmentAction
{
    public function execute(
        User $uploader,
        Model $owner,
        UploadedFile $file,
        string $kind = 'document',
        ?Carbon $retentionUntil = null
    ): Attachment {
        $sizeBytes = (int) $file->getSize();
        if ($sizeBytes > (int) config('attachments.max_bytes')) {
            throw new InvalidArgumentException('File size exceeds the maximum limit of 15 MiB.');
        }

        if ($sizeBytes === 0) {
            throw new InvalidArgumentException('File cannot be empty.');
        }

        $mimeType = $file->getMimeType();
        $extension = config("attachments.mime_extensions.{$mimeType}");
        if (! is_string($extension)) {
            throw new InvalidArgumentException('Unsupported file MIME type. Only JPEG, PNG, HEIC/HEIF, and PDF are allowed.');
        }

        Gate::forUser($uploader)->authorize('view', $owner);

        $disk = (string) config('attachments.disk');
        $storedPath = null;
        $requestId = request()->header('X-Request-ID');
        if (! is_string($requestId) || ! Str::isUuid($requestId)) {
            $requestId = (string) Str::uuid();
        }

        try {
            return DB::transaction(function () use ($uploader, $owner, $file, $kind, $mimeType, $extension, $retentionUntil, $sizeBytes, $disk, $requestId, &$storedPath): Attachment {
                // Serialize uploads per owner by locking its concrete row. PostgreSQL
                // does not permit FOR UPDATE on an aggregate COUNT query, and locking
                // only existing attachments would leave the zero-attachment case open.
                $owner->newQuery()->whereKey($owner->getKey())->lockForUpdate()->firstOrFail();

                $existingCount = Attachment::query()
                    ->where('owner_type', $owner->getMorphClass())
                    ->where('owner_id', $owner->getKey())
                    ->count();

                if ($existingCount >= (int) config('attachments.max_count_per_owner')) {
                    throw new InvalidArgumentException('Maximum attachment limit reached for this item.');
                }

                $checksum = hash_file('sha256', $file->getRealPath());
                $relativeDir = sprintf('attachments/%s/%s', date('Y'), date('m'));
                $filename = sprintf('%s.%s', (string) Str::uuid(), $extension);
                $path = sprintf('%s/%s', $relativeDir, $filename);
                $originalFilename = str_replace(["\0", '/', '\\'], '_', $file->getClientOriginalName());

                $storedPath = Storage::disk($disk)->putFileAs($relativeDir, $file, $filename);
                if ($storedPath !== $path) {
                    throw new \RuntimeException('Unable to store attachment in private storage.');
                }

                $attachment = Attachment::query()->create([
                    'owner_type' => $owner->getMorphClass(),
                    'owner_id' => $owner->getKey(),
                    'uploaded_by' => $uploader->id,
                    'kind' => $kind,
                    'disk' => $disk,
                    'path' => $path,
                    'original_filename' => $originalFilename,
                    'mime_type' => $mimeType,
                    'size_bytes' => $sizeBytes,
                    'checksum_sha256' => $checksum,
                    'retention_until' => $retentionUntil,
                ]);

                AuditEvent::query()->create([
                    'actor_id' => $uploader->id,
                    'subject_type' => $attachment->getMorphClass(),
                    'subject_id' => $attachment->id,
                    'action' => 'attachment.uploaded',
                    'after_state' => [
                        'owner_type' => $owner->getMorphClass(),
                        'owner_id' => $owner->getKey(),
                        'original_filename' => $attachment->original_filename,
                        'mime_type' => $mimeType,
                        'size_bytes' => $attachment->size_bytes,
                        'checksum_sha256' => $checksum,
                    ],
                    'request_id' => $requestId,
                    'ip_address' => request()->ip(),
                    'occurred_at' => now(),
                ]);

                return $attachment;
            });
        } catch (\Throwable $exception) {
            if (is_string($storedPath) && Storage::disk($disk)->exists($storedPath)) {
                Storage::disk($disk)->delete($storedPath);
            }

            throw $exception;
        }
    }
}
