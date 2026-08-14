<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ConvertServiceRequestToDispatch
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /**
     * @param  array{
     *     reference: string,
     *     scheduled_start: string,
     *     scheduled_end: string
     * }  $attributes
     */
    public function handle(int $serviceRequestId, User $actor, array $attributes): DispatchJob
    {
        return DB::transaction(function () use ($serviceRequestId, $actor, $attributes): DispatchJob {
            $serviceRequest = ServiceRequest::query()
                ->with('client')
                ->lockForUpdate()
                ->find($serviceRequestId);

            if ($serviceRequest === null) {
                throw ValidationException::withMessages([
                    'service_request_id' => 'The selected service request is no longer available.',
                ]);
            }

            $status = ServiceRequestStatus::tryFrom((string) $serviceRequest->getRawOriginal('status'));

            if ($status === null || ! $status->canCreateDispatch()) {
                throw ValidationException::withMessages([
                    'service_request_id' => 'The selected service request cannot create another dispatch.',
                ]);
            }

            if ($serviceRequest->client === null || $serviceRequest->client->status !== 'active') {
                throw ValidationException::withMessages([
                    'service_request_id' => 'The service request client must be active before conversion.',
                ]);
            }

            if (DispatchJob::query()->withTrashed()->where('reference', $attributes['reference'])->exists()) {
                throw ValidationException::withMessages([
                    'reference' => 'The dispatch reference has already been taken.',
                ]);
            }

            $job = DispatchJob::query()->create([
                'service_request_id' => $serviceRequest->id,
                'source_type' => 'service_request',
                'source_id' => $serviceRequest->id,
                'source_reference' => $serviceRequest->reference,
                'reference' => $attributes['reference'],
                'client' => $serviceRequest->client->company_name,
                'title' => $serviceRequest->project_name,
                'site' => $serviceRequest->location,
                'site_notes' => $serviceRequest->site_notes,
                'scheduled_start' => $attributes['scheduled_start'],
                'scheduled_end' => $attributes['scheduled_end'],
                'priority' => $serviceRequest->priority,
                'status' => DispatchStatus::Draft,
                'requirements' => $serviceRequest->requirements,
                'created_by' => $actor->id,
                'version' => 1,
            ]);

            $this->audit->handle($actor, $job, 'dispatch.created', null, $job->toArray());

            if ($status === ServiceRequestStatus::Submitted) {
                $before = $serviceRequest->toArray();
                $serviceRequest->update(['status' => ServiceRequestStatus::Dispatching]);
                $this->audit->handle(
                    $actor,
                    $serviceRequest,
                    'service_request.dispatch_started',
                    $before,
                    $serviceRequest->fresh()?->toArray(),
                );
            }

            return $job;
        });
    }
}
