<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class CreateDispatchFromSource
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /**
     * @param  array{
     *     reference: string,
     *     client: string,
     *     title: string,
     *     site: string,
     *     site_notes?: string|null,
     *     scheduled_start: Carbon|string,
     *     scheduled_end: Carbon|string,
     *     priority?: DispatchPriority|string,
     *     requirements?: array<int, string>
     * }  $attributes
     */
    public function handle(
        User $actor,
        Model $source,
        DispatchSourceType $sourceType,
        array $attributes,
    ): DispatchJob {
        Gate::forUser($actor)->authorize('create', DispatchJob::class);

        if ($source->getMorphClass() !== $sourceType->value) {
            throw ValidationException::withMessages([
                'source' => 'The operational source type does not match the selected source record.',
            ]);
        }

        $sourceId = (int) $source->getKey();
        $sourceReference = (string) $source->getAttribute('reference');

        if ($sourceId < 1 || $sourceReference === '') {
            throw ValidationException::withMessages([
                'source' => 'The operational source is missing a stable identifier or reference.',
            ]);
        }

        return DB::transaction(function () use ($actor, $source, $sourceType, $sourceId, $sourceReference, $attributes): DispatchJob {
            $lockedSource = $source->newQuery()->lockForUpdate()->find($sourceId);

            if (! $lockedSource instanceof Model || (method_exists($lockedSource, 'trashed') && $lockedSource->trashed())) {
                throw ValidationException::withMessages([
                    'source' => 'The operational source is no longer available.',
                ]);
            }

            if (DispatchJob::query()->withTrashed()->where('reference', $attributes['reference'])->exists()) {
                throw ValidationException::withMessages([
                    'reference' => 'The dispatch reference has already been taken.',
                ]);
            }

            $priority = $attributes['priority'] ?? DispatchPriority::Routine;
            $priority = $priority instanceof DispatchPriority
                ? $priority
                : DispatchPriority::from((string) $priority);

            $job = DispatchJob::query()->create([
                'source_type' => $sourceType->value,
                'source_id' => $lockedSource->getKey(),
                'source_reference' => $sourceReference,
                'reference' => $attributes['reference'],
                'client' => $attributes['client'],
                'title' => $attributes['title'],
                'site' => $attributes['site'],
                'site_notes' => $attributes['site_notes'] ?? null,
                'scheduled_start' => $attributes['scheduled_start'],
                'scheduled_end' => $attributes['scheduled_end'],
                'priority' => $priority,
                'status' => DispatchStatus::Draft,
                'requirements' => $attributes['requirements'] ?? [],
                'created_by' => $actor->id,
                'version' => 1,
            ]);

            $this->audit->handle($actor, $job, 'dispatch.created', null, $job->toArray());

            return $job;
        });
    }
}
