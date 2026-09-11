<?php

namespace App\Modules\Dispatch\Http\Requests;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class TransitionDispatchJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        $job = $this->route('dispatchJob');
        $user = $this->user();

        if (! $job instanceof DispatchJob || $user === null) {
            return false;
        }

        if (! $user->can('view', $job)) {
            abort(404);
        }

        return $user->can('updateOwnStatus', $job);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['status' => ['required', Rule::enum(DispatchStatus::class)], 'version' => ['required', 'integer', 'min:1']];
    }
}
