<?php

namespace App\Platform\Tracking\Http\Requests;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class StoreLocationUpdateRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->boolean('sharing_enabled')) {
            $this->merge([
                'latitude' => null,
                'longitude' => null,
                'accuracy_metres' => null,
                'operational_asset_id' => null,
                'dispatch_job_id' => null,
            ]);

            return;
        }

        if (! $this->filled('dispatch_job_id')) {
            $jobId = DispatchJob::query()
                ->whereIn('id', DispatchPersonnelAssignment::query()
                    ->active()
                    ->where('user_id', $this->user()?->id)
                    ->select('dispatch_job_id'))
                ->latest('scheduled_start')
                ->value('id');

            if ($jobId !== null) {
                $this->merge(['dispatch_job_id' => $jobId]);
            }
        }
    }

    public function authorize(): bool
    {
        return $this->user()?->can(PermissionName::TrackingShareOwn->value) ?? false;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'latitude' => ['required_if:sharing_enabled,true', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_if:sharing_enabled,true', 'nullable', 'numeric', 'between:-180,180'],
            'accuracy_metres' => ['nullable', 'numeric', 'min:0', 'max:10000'],
            'captured_at' => ['required', 'date'],
            'sharing_enabled' => ['required', 'boolean'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'command_id' => ['nullable', 'uuid'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $capturedAtRaw = $this->input('captured_at');
            if (is_string($capturedAtRaw) && $capturedAtRaw !== '') {
                try {
                    $parsed = CarbonImmutable::parse($capturedAtRaw);
                    if ($parsed->greaterThan(now()->addSeconds(300))) {
                        $validator->errors()->add('captured_at', 'The captured_at timestamp cannot be in the future beyond clock drift tolerance.');
                    }
                } catch (\Throwable) {
                    $validator->errors()->add('captured_at', 'The captured_at timestamp is invalid.');
                }
            }

            if (! $this->boolean('sharing_enabled')) {
                return;
            }

            $jobId = $this->input('dispatch_job_id');
            $job = $jobId === null ? null : DispatchJob::query()
                ->whereKey($jobId)
                ->whereIn('id', DispatchPersonnelAssignment::query()
                    ->active()
                    ->where('user_id', $this->user()?->id)
                    ->select('dispatch_job_id'))
                ->first();

            if (! $job instanceof DispatchJob) {
                $validator->errors()->add('dispatch_job_id', 'Location sharing requires an active assignment to the selected dispatch job.');

                return;
            }

            $assetId = $this->input('operational_asset_id');
            if ($assetId !== null && ! $job->assetAssignments()->active()->where('operational_asset_id', $assetId)->exists()) {
                $validator->errors()->add('operational_asset_id', 'The selected asset is not actively assigned to this dispatch job.');
            }

            if ($assetId !== null && ! OperationalAsset::query()->whereKey($assetId)->exists()) {
                $validator->errors()->add('operational_asset_id', 'The selected asset does not exist.');
            }
        });
    }
}
