<?php

namespace App\Modules\Dispatch\Actions;

use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ConvertServiceRequestToDispatch
{
    public function __construct(
        private readonly RecordAuditEvent $audit,
        private readonly CreateDispatchFromSource $dispatch,
    ) {}

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

            $job = $this->dispatch->handleWithinTransaction($actor, $serviceRequest, DispatchSourceType::ServiceRequest, [
                'reference' => $attributes['reference'],
                'client' => $serviceRequest->client->company_name,
                'title' => $serviceRequest->project_name,
                'site' => $serviceRequest->location,
                'site_notes' => $serviceRequest->site_notes,
                'scheduled_start' => $attributes['scheduled_start'],
                'scheduled_end' => $attributes['scheduled_end'],
                'priority' => $serviceRequest->priority,
                'requirements' => $serviceRequest->requirements,
            ]);

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
