<?php

namespace App\Platform\Audit\Http\Requests;

use App\Platform\Audit\Enums\AuditCategory;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AuditEventIndexRequest extends FormRequest
{
    /** A calendar date, or an ISO 8601 timestamp with an offset for local day bounds. */
    private const BOUND_PATTERN = '/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2}))?$/';

    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::AuditView->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $bound = ['bail', 'nullable', 'string', 'regex:'.self::BOUND_PATTERN, 'date'];

        return [
            'category' => ['sometimes', 'nullable', Rule::in(['all', ...array_column(AuditCategory::cases(), 'value')])],
            'actor' => ['sometimes', 'nullable', 'regex:/^(system|[1-9]\d{0,9})$/'],
            'from' => $bound,
            'to' => [...$bound, 'after_or_equal:from'],
            'q' => ['sometimes', 'nullable', 'string', 'max:200'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    /**
     * @return array{category: AuditCategory|null, actor: string|null, from: string|null, to: string|null, q: string|null, per_page: int}
     */
    public function filters(): array
    {
        $category = $this->input('category');
        $search = trim((string) $this->input('q', ''));

        return [
            'category' => is_string($category) && $category !== 'all' ? AuditCategory::from($category) : null,
            'actor' => $this->filled('actor') ? (string) $this->input('actor') : null,
            'from' => $this->filled('from') ? (string) $this->input('from') : null,
            'to' => $this->filled('to') ? (string) $this->input('to') : null,
            'q' => $search === '' ? null : $search,
            'per_page' => (int) $this->input('per_page', 25),
        ];
    }
}
