<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\DispatchStatus;
use App\Http\Requests\StoreDispatchJobRequest;
use App\Models\DispatchJob;
use App\Models\ServiceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

final class DispatchJobController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', DispatchJob::class);

        return response()->json(['data' => DispatchJob::query()->visibleTo(request()->user())->with(['personnelAssignments', 'assetAssignments.asset'])->latest('scheduled_start')->paginate(25)]);
    }

    public function store(StoreDispatchJobRequest $request, RecordAuditEvent $audit): JsonResponse
    {
        $validated = $request->validated();

        if (isset($validated['service_request_id'])) {
            $serviceRequest = ServiceRequest::query()->findOrFail($request->integer('service_request_id'));
            $serviceRequest->load('client');
            $validated = [
                ...[
                    'client' => $serviceRequest->client->company_name,
                    'title' => $serviceRequest->project_name,
                    'site' => $serviceRequest->location,
                    'site_notes' => $serviceRequest->site_notes,
                    'scheduled_start' => $serviceRequest->scheduled_date,
                    'priority' => $serviceRequest->priority,
                    'requirements' => $serviceRequest->requirements,
                ],
                ...$validated,
            ];
        }

        $job = DispatchJob::query()->create([...$validated, 'status' => DispatchStatus::Draft, 'created_by' => $request->user()->id]);
        $audit->handle($request->user(), $job, 'dispatch.created', null, $job->toArray());

        return response()->json(['data' => $job], 201);
    }

    public function show(int $dispatchJob): JsonResponse
    {
        $job = DispatchJob::query()->visibleTo(request()->user())->with(['personnelAssignments.user', 'assetAssignments.asset', 'approvals'])->findOrFail($dispatchJob);
        Gate::authorize('view', $job);

        return response()->json(['data' => $job]);
    }
}
