<?php

namespace App\Http\Requests;

use App\Models\DispatchJob;
use App\Models\JobReport;
use Illuminate\Foundation\Http\FormRequest;

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
            'work_summary' => ['required', 'string', 'max:5000'],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:15360'], // 15MB
        ];
    }
}
