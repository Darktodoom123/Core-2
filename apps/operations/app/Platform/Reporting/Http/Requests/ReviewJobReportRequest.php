<?php

namespace App\Platform\Reporting\Http\Requests;

use App\Platform\Reporting\Models\JobReport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ReviewJobReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var JobReport|string|int|null $report */
        $report = $this->route('jobReport');

        if (! $report instanceof JobReport && is_numeric($report)) {
            $report = JobReport::query()->find($report);
        }

        return $report instanceof JobReport && Gate::forUser($this->user())->allows('review', $report);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:approved,rejected'],
            'reason' => ['required_if:status,rejected', 'nullable', 'string', 'max:1000'],
        ];
    }
}
