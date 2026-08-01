<?php

namespace App\Platform\Attachments\Http\Requests;

use App\Platform\Attachments\Models\Attachment;
use App\Platform\Attachments\Services\AttachmentOwnerResolver;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UploadAttachmentRequest extends FormRequest
{
    public const ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/heic',
        'image/heif',
        'image/heic-sequence',
        'image/heif-sequence',
        'application/pdf',
    ];

    public function authorize(): bool
    {
        return $this->user()->can('create', Attachment::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:15360'], // 15MB max
            'owner_type' => ['required', 'string', Rule::in(AttachmentOwnerResolver::acceptedTypes())],
            'owner_id' => ['required', 'integer', 'min:1'],
            'kind' => ['nullable', 'string', 'max:32'],
            'retention_until' => ['nullable', 'date'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $file = $this->file('file');
            if ($file && $file->isValid()) {
                $mimeType = $file->getMimeType();
                if (! in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
                    $validator->errors()->add('file', 'The file must be a JPEG, PNG, HEIC/HEIF, or PDF document.');
                }

                if ($file->getSize() === 0) {
                    $validator->errors()->add('file', 'The file cannot be empty.');
                }
            }

            // Check owner attachment count limit (max 10)
            $ownerType = $this->input('owner_type');
            $ownerId = $this->input('owner_id');

            if ($ownerType && $ownerId) {
                $morphClass = AttachmentOwnerResolver::classFor((string) $ownerType);

                if ($morphClass === null) {
                    return;
                }

                if (! $morphClass::query()->whereKey($ownerId)->exists()) {
                    $validator->errors()->add('owner_id', 'The selected attachment owner does not exist.');

                    return;
                }

                $existingCount = Attachment::query()
                    ->where('owner_type', $morphClass)
                    ->where('owner_id', $ownerId)
                    ->count();

                if ($existingCount >= 10) {
                    $validator->errors()->add('file', 'Maximum attachment limit (10 files) reached for this item.');
                }
            }
        });
    }
}
