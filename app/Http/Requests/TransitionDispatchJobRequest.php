<?php

namespace App\Http\Requests;

use App\Enums\DispatchStatus;
use App\Models\DispatchJob;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class TransitionDispatchJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        $job = $this->route('dispatchJob');

        return $job instanceof DispatchJob && ($this->user()?->can('updateOwnStatus', $job) ?? false);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return ['status' => ['required', Rule::enum(DispatchStatus::class)], 'version' => ['required', 'integer', 'min:1']];
    }
}
