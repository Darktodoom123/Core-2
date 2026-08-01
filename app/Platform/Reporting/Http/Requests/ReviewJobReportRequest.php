<?php

namespace App\Platform\Reporting\Http\Requests;

use App\Platform\Reporting\Models\JobReport;
use Illuminate\Foundation\Http\FormRequest;

class ReviewJobReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var JobReport|null $report */
        $report = $this->route('jobReport');

        return $report !== null && $this->user()->can('review', $report);
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
