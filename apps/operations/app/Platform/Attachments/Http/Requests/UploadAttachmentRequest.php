<?php

namespace App\Platform\Attachments\Http\Requests;

use App\Platform\Attachments\Models\Attachment;
use App\Platform\Attachments\Services\AttachmentFilePolicy;
use App\Platform\Attachments\Services\AttachmentOwnerResolver;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UploadAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Attachment::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.(int) ceil((int) config('attachments.max_bytes') / 1024)],
            'owner_type' => ['required', 'string', Rule::in(AttachmentOwnerResolver::acceptedTypes())],
            'owner_id' => ['required', 'integer', 'min:1'],
            'kind' => ['nullable', 'string', 'max:32'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $file = $this->file('file');
            if ($file && $file->isValid()) {
                try {
                    AttachmentFilePolicy::validate($file);
                } catch (\InvalidArgumentException $exception) {
                    $validator->errors()->add('file', $exception->getMessage());
                }
            }

            if ($this->input('owner_type') === 'site_hazard_ticket') {
                if ($this->input('kind') !== 'hazard_photo') {
                    $validator->errors()->add('kind', 'Hazard evidence must use the hazard photo attachment type.');
                }

                if ($file && $file->isValid() && ! str_starts_with((string) $file->getMimeType(), 'image/')) {
                    $validator->errors()->add('file', 'Hazard evidence must be a JPEG, PNG, or HEIC image.');
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

                if ($ownerType === 'site_hazard_ticket' && $this->input('kind') === 'hazard_photo') {
                    $hazardPhotoCount = Attachment::query()
                        ->where('owner_type', $morphClass)
                        ->where('owner_id', $ownerId)
                        ->where('kind', 'hazard_photo')
                        ->count();

                    if ($hazardPhotoCount >= 4) {
                        $validator->errors()->add('file', 'A hazard report can have up to four photo evidence files.');
                    }
                }

                if ($existingCount >= (int) config('attachments.max_count_per_owner')) {
                    $validator->errors()->add('file', 'Maximum attachment limit reached for this item.');
                }
            }
        });
    }
}
