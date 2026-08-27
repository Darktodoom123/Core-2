<?php

namespace App\Modules\Assignment\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListDispatchCandidatesRequest extends FormRequest
{
    /** @var list<string> */
    private const PERSONNEL_TYPES = ['driver', 'crane_operator'];

    /** @var list<string> */
    private const ASSET_TYPES = ['truck', 'crane', 'mobile_crane', 'equipment'];

    public function authorize(): bool
    {
        // The dispatch-detail shell is also visible to assigned field users.
        // The controller is the authoritative candidate authorization boundary.
        return $this->user() !== null;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'resource' => ['nullable', Rule::in(['personnel', 'assets'])],
            'type' => ['nullable', Rule::in([...self::PERSONNEL_TYPES, ...self::ASSET_TYPES])],
            'search' => ['nullable', 'string', 'max:80'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
            'eligible_only' => ['nullable', 'boolean'],
        ];
    }

    public function resource(): ?string
    {
        $resource = $this->string('resource')->toString();

        return in_array($resource, ['personnel', 'assets'], true) ? $resource : null;
    }

    public function type(): ?string
    {
        $type = $this->string('type')->toString();

        return $type !== '' ? $type : null;
    }

    public function search(): ?string
    {
        $search = trim($this->string('search')->toString());

        return $search !== '' ? $search : null;
    }

    public function page(): int
    {
        return max(1, $this->integer('page', 1));
    }

    public function perPage(): int
    {
        return min(50, max(1, $this->integer('per_page', 25)));
    }

    public function eligibleOnly(): bool
    {
        return $this->boolean('eligible_only');
    }

    /** @return list<string> */
    public static function personnelTypes(): array
    {
        return self::PERSONNEL_TYPES;
    }

    /** @return list<string> */
    public static function assetTypes(): array
    {
        return self::ASSET_TYPES;
    }
}
