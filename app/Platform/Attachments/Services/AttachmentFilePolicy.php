<?php

namespace App\Platform\Attachments\Services;

use Illuminate\Http\UploadedFile;
use InvalidArgumentException;

final class AttachmentFilePolicy
{
    public static function validate(UploadedFile $file): string
    {
        if (! $file->isValid()) {
            throw new InvalidArgumentException('The uploaded file could not be read. Please choose it again.');
        }

        $originalFilename = $file->getClientOriginalName();
        if (str_contains($originalFilename, '/') || str_contains($originalFilename, '\\')) {
            throw new InvalidArgumentException('File names cannot contain path segments.');
        }

        $sizeBytes = (int) $file->getSize();
        if ($sizeBytes > (int) config('attachments.max_bytes')) {
            throw new InvalidArgumentException('File size exceeds the maximum limit of 15 MiB.');
        }

        if ($sizeBytes === 0) {
            throw new InvalidArgumentException('File cannot be empty.');
        }

        $mimeType = $file->getMimeType();
        if (! is_string($mimeType) || ! array_key_exists($mimeType, config('attachments.mime_extensions', []))) {
            throw new InvalidArgumentException('Unsupported file MIME type. Only JPEG, PNG, HEIC/HEIF, and PDF are allowed.');
        }

        return $mimeType;
    }
}
