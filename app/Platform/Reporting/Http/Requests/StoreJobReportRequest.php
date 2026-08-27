<?php

namespace App\Platform\Reporting\Http\Requests;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Services\AttachmentFilePolicy;
use App\Platform\Reporting\Models\JobReport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreJobReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        $jobId = $this->input('dispatch_job_id');
        if (! $jobId) {
            return false;
        }

        $job = DispatchJob::query()->find($jobId);
        if (! $job) {
            return false;
        }

        return $this->user()->can('create', [JobReport::class, $job]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'dispatch_job_id' => ['required', 'integer', 'exists:dispatch_jobs,id'],
            'started_at' => ['nullable', 'date'],
            'ended_at' => ['nullable', 'date', 'after_or_equal:started_at'],
            'ending_meter_value' => ['nullable', 'numeric', 'min:0'],
            'meter_type' => ['nullable', 'string', 'in:odometer_km,engine_hours,none'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'work_summary' => ['required', 'string', 'max:5000'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'is_draft' => ['nullable', 'boolean'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:15360'], // 15 MiB
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $files = $this->file('attachments', []);
            if (! is_array($files)) {
                return;
            }

            foreach ($files as $index => $file) {
                if (! $file->isValid()) {
                    continue;
                }

                try {
                    AttachmentFilePolicy::validate($file);
                } catch (\InvalidArgumentException $exception) {
                    $validator->errors()->add("attachments.{$index}", $exception->getMessage());
                }
            }
        });
    }
}
