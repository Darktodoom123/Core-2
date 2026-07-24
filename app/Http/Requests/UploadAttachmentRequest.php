<?php

namespace App\Http\Requests;

use App\Models\Attachment;
use App\Models\DispatchJob;
use App\Models\FuelRequest;
use App\Models\JobReport;
use App\Models\OperationalAsset;
use Illuminate\Foundation\Http\FormRequest;
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
            'owner_type' => ['required', 'string'],
            'owner_id' => ['required', 'integer'],
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
                // Normalize ownerType class name
                $morphClass = match ($ownerType) {
                    'job_report', 'JobReport', 'job_reports' => JobReport::class,
                    'dispatch_job', 'DispatchJob', 'dispatch_jobs' => DispatchJob::class,
                    'operational_asset', 'OperationalAsset', 'operational_assets' => OperationalAsset::class,
                    'fuel_request', 'FuelRequest', 'fuel_requests' => FuelRequest::class,
                    default => $ownerType,
                };

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
