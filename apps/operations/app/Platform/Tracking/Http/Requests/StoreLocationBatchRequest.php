<?php

namespace App\Platform\Tracking\Http\Requests;

use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The envelope of a ping batch. Each ping's own fields are checked one by
 * one by the controller, so one bad ping is refused on its own.
 */
final class StoreLocationBatchRequest extends FormRequest
{
    public const MAX_PINGS = 50;

    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::TrackingShareOwn->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'pings' => ['required', 'array', 'list', 'min:1', 'max:'.self::MAX_PINGS],
            'pings.*' => ['required', 'array'],
            'pings.*.command_id' => ['required', 'uuid', 'distinct'],
        ];
    }
}
