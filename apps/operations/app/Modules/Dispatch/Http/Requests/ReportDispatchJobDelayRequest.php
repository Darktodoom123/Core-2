<?php

namespace App\Modules\Dispatch\Http\Requests;

use App\Modules\Dispatch\Enums\DelayContext;
use App\Modules\Dispatch\Enums\DelayReason;
use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReportDispatchJobDelayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Authorized in controller via policy
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'context' => ['required', 'string', Rule::in(['transit', 'on_site'])],
            'reason' => ['required', 'string', 'max:128'],
            'reason_label' => ['nullable', 'string', 'max:128'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'version' => ['nullable', 'integer'],
            'reported_at' => ['nullable', 'date'],
            'command_id' => ['nullable', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $contextStr = (string) $this->input('context');
            $context = DelayContext::tryFrom($contextStr);
            $reasonInput = (string) $this->input('reason');

            if ($context !== null && $reasonInput !== '') {
                if (! DelayReason::isValidForContext($reasonInput, $context)) {
                    $v->errors()->add('reason', "The selected reason is not valid for {$contextStr} delays.");
                }
            }

            /** @var DispatchJob|null $job */
            $job = $this->route('dispatchJob');
            $assetId = $this->input('operational_asset_id') ?? $this->input('asset_id');

            if ($job instanceof DispatchJob && $assetId !== null) {
                $isAssigned = $job->assetAssignments()
                    ->where('operational_asset_id', (int) $assetId)
                    ->exists();

                if (! $isAssigned) {
                    $errorKey = $this->has('operational_asset_id') ? 'operational_asset_id' : 'asset_id';
                    $v->errors()->add($errorKey, 'The selected asset is not assigned to this dispatch job.');
                }
            }

            $reportedAtInput = $this->input('reported_at');
            if ($reportedAtInput !== null && $job instanceof DispatchJob) {
                try {
                    $parsed = Carbon::parse((string) $reportedAtInput);
                    if ($parsed->isAfter(now()->addMinutes(5))) {
                        $v->errors()->add('reported_at', 'The reported timestamp cannot be in the future.');
                    } elseif ($job->created_at !== null && $parsed->isBefore($job->created_at->subMinutes(10))) {
                        $v->errors()->add('reported_at', 'The reported timestamp cannot be before the dispatch job was created.');
                    }
                } catch (\Throwable) {
                    $v->errors()->add('reported_at', 'Invalid reported timestamp format.');
                }
            }
        });
    }

    public function resolvedAssetId(): ?int
    {
        $id = $this->input('operational_asset_id') ?? $this->input('asset_id');

        return $id !== null ? (int) $id : null;
    }

    public function resolvedDelayReason(DelayContext $context): DelayReason
    {
        $reasonInput = (string) $this->input('reason');
        $normalized = DelayReason::normalize($reasonInput, $context);

        return $normalized ?? DelayReason::Other;
    }
}
