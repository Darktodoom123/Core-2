<?php

namespace App\Actions;

use App\Models\Attachment;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;

class UploadAttachmentAction
{
    public function execute(
        User $uploader,
        Model $owner,
        UploadedFile $file,
        string $kind = 'document',
        ?Carbon $retentionUntil = null
    ): Attachment {
        // Enforce max size: 15 MB = 15728640 bytes
        if ($file->getSize() > 15728640) {
            throw new InvalidArgumentException('File size exceeds the maximum limit of 15 MiB.');
        }

        if ($file->getSize() === 0) {
            throw new InvalidArgumentException('File cannot be empty.');
        }

        // Validate MIME type
        $allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/heic',
            'image/heif',
            'image/heic-sequence',
            'image/heif-sequence',
            'application/pdf',
        ];

        $mimeType = $file->getMimeType();
        if (! in_array($mimeType, $allowedMimes, true)) {
            throw new InvalidArgumentException('Unsupported file MIME type. Only JPEG, PNG, HEIC/HEIF, and PDF are allowed.');
        }

        // Check owner attachment count limit (max 10)
        $existingCount = Attachment::query()
            ->where('owner_type', $owner->getMorphClass())
            ->where('owner_id', $owner->getKey())
            ->count();

        if ($existingCount >= 10) {
            throw new InvalidArgumentException('Maximum attachment limit of 10 files per record has been reached.');
        }

        return DB::transaction(function () use ($uploader, $owner, $file, $kind, $mimeType, $retentionUntil): Attachment {
            $checksum = hash_file('sha256', $file->getRealPath());
            $uuid = (string) Str::uuid();
            $extension = $file->getClientOriginalExtension() ?: 'bin';
            $relativeDir = sprintf('attachments/%s/%s', date('Y'), date('m'));
            $filename = sprintf('%s.%s', $uuid, $extension);
            $path = sprintf('%s/%s', $relativeDir, $filename);

            // Store on local private disk
            Storage::disk('local')->putFileAs($relativeDir, $file, $filename);

            $attachment = Attachment::query()->create([
                'owner_type' => $owner->getMorphClass(),
                'owner_id' => $owner->getKey(),
                'uploaded_by' => $uploader->id,
                'kind' => $kind,
                'disk' => 'local',
                'path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $mimeType,
                'size_bytes' => $file->getSize(),
                'checksum_sha256' => $checksum,
                'retention_until' => $retentionUntil,
            ]);

            AuditEvent::query()->create([
                'actor_id' => $uploader->id,
                'subject_type' => Attachment::class,
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
                'request_id' => request()->header('X-Request-ID') ?? request()->ip(),
                'ip_address' => request()->ip(),
                'occurred_at' => now(),
            ]);

            return $attachment;
        });
    }
}
