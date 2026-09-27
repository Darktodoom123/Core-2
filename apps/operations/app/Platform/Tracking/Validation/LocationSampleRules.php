<?php

namespace App\Platform\Tracking\Validation;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Validator;
use Throwable;

/**
 * The checks for one location sample, shared by the single and batch
 * endpoints so a ping is judged the same way however it arrives.
 */
final class LocationSampleRules
{
    /**
     * Clears coordinates on a pause and fills in the job a ping without one
     * belongs to.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public static function normalize(?User $user, array $input): array
    {
        if (! filter_var($input['sharing_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return [
                ...$input,
                'latitude' => null,
                'longitude' => null,
                'accuracy_metres' => null,
                'operational_asset_id' => null,
                'dispatch_job_id' => null,
            ];
        }

        if (($input['dispatch_job_id'] ?? null) !== null && $input['dispatch_job_id'] !== '') {
            return $input;
        }

        $jobId = DispatchJob::query()
            ->whereIn('id', self::assignmentsAt($user, self::capturedAt($input))->select('dispatch_job_id'))
            ->latest('scheduled_start')
            ->value('id');

        return $jobId === null ? $input : [...$input, 'dispatch_job_id' => $jobId];
    }

    /** @return array<string, mixed> */
    public static function rules(): array
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

    /**
     * The sample's time must be believable and, while sharing, the operator
     * must be assigned to the job (and the unit to the job) at that time.
     *
     * @param  array<string, mixed>  $input
     */
    public static function after(Validator $validator, ?User $user, array $input): void
    {
        $capturedAtRaw = $input['captured_at'] ?? null;
        if (is_string($capturedAtRaw) && $capturedAtRaw !== '') {
            try {
                $parsed = CarbonImmutable::parse($capturedAtRaw);
                if ($parsed->greaterThan(now()->addSeconds(300))) {
                    $validator->errors()->add('captured_at', 'The captured_at timestamp cannot be in the future beyond clock drift tolerance.');
                }
            } catch (Throwable) {
                $validator->errors()->add('captured_at', 'The captured_at timestamp is invalid.');
            }
        }

        if (! filter_var($input['sharing_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        $capturedAt = self::capturedAt($input);
        $jobId = $input['dispatch_job_id'] ?? null;
        $job = $jobId === null ? null : DispatchJob::query()
            ->whereKey($jobId)
            ->whereIn('id', self::assignmentsAt($user, $capturedAt)->select('dispatch_job_id'))
            ->first();

        if (! $job instanceof DispatchJob) {
            $validator->errors()->add('dispatch_job_id', 'Location sharing requires an active assignment to the selected dispatch job.');

            return;
        }

        $assetId = $input['operational_asset_id'] ?? null;
        if ($assetId === null) {
            return;
        }

        if (! self::assetAssignedAt($job, $assetId, $capturedAt)) {
            $validator->errors()->add('operational_asset_id', 'The selected asset is not actively assigned to this dispatch job.');
        }

        if (! OperationalAsset::query()->whereKey($assetId)->exists()) {
            $validator->errors()->add('operational_asset_id', 'The selected asset does not exist.');
        }
    }

    /** @param  array<string, mixed>  $input */
    private static function capturedAt(array $input): ?Carbon
    {
        $raw = $input['captured_at'] ?? null;
        if ($raw === null || $raw === '') {
            return null;
        }

        try {
            return Carbon::parse($raw);
        } catch (Throwable) {
            return null;
        }
    }

    /** @return Builder<DispatchPersonnelAssignment> */
    private static function assignmentsAt(?User $user, ?Carbon $capturedAt): Builder
    {
        $query = DispatchPersonnelAssignment::query()->where('user_id', $user?->id);

        if ($capturedAt === null) {
            return $query->active();
        }

        return $query->where(function (Builder $q) use ($capturedAt): void {
            $q->where(function (Builder $inner) use ($capturedAt): void {
                $inner->whereNull('active_from')->orWhere('active_from', '<=', $capturedAt);
            })->where(function (Builder $inner) use ($capturedAt): void {
                $inner->whereNull('active_until')->orWhere('active_until', '>=', $capturedAt);
            });
        });
    }

    /** The unit is assigned to the job at the sample's time. */
    private static function assetAssignedAt(DispatchJob $job, int|string $assetId, ?Carbon $capturedAt): bool
    {
        $query = DispatchAssetAssignment::query()
            ->where('dispatch_job_id', $job->id)
            ->where('operational_asset_id', $assetId);

        if ($capturedAt === null) {
            return $query->active()->exists();
        }

        return $query->where(function (Builder $q) use ($capturedAt): void {
            $q->where(function (Builder $inner) use ($capturedAt): void {
                $inner->whereNull('active_from')->orWhere('active_from', '<=', $capturedAt);
            })->where(function (Builder $inner) use ($capturedAt): void {
                $inner->whereNull('active_until')->orWhere('active_until', '>=', $capturedAt);
            });
        })->exists();
    }
}
