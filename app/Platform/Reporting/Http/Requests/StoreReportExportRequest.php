<?php

namespace App\Platform\Reporting\Http\Requests;

use App\Platform\Reporting\Enums\ReportExportType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreReportExportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null && $this->user()->can('create', \App\Platform\Reporting\Models\ReportExport::class);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'export_type' => ['required', 'string', Rule::enum(ReportExportType::class)],
            'format' => ['required', 'string', Rule::in(['csv', 'xlsx'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ];
    }
}
