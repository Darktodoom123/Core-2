<?php

namespace App\Http\Controllers;

use App\Actions\ConvertServiceRequestToDispatch;
use App\Actions\RecordAuditEvent;
use App\Enums\DispatchStatus;
use App\Http\Requests\StoreDispatchJobRequest;
use App\Models\DispatchJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class DispatchJobController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize('viewAny', DispatchJob::class);

        return response()->json(['data' => DispatchJob::query()->visibleTo(request()->user())->with(['personnelAssignments', 'assetAssignments.asset'])->latest('scheduled_start')->paginate(25)]);
    }

    public function store(
        StoreDispatchJobRequest $request,
        ConvertServiceRequestToDispatch $convert,
        RecordAuditEvent $audit,
    ): RedirectResponse {
        $validated = $request->validated();

        if (isset($validated['service_request_id'])) {
            $job = $convert->handle(
                (int) $validated['service_request_id'],
                $request->user(),
                [
                    'reference' => $validated['reference'],
                    'scheduled_start' => $validated['scheduled_start'],
                    'scheduled_end' => $validated['scheduled_end'],
                ],
            );
        } else {
            $job = DispatchJob::query()->create([
                ...$validated,
                'status' => DispatchStatus::Draft,
                'created_by' => $request->user()->id,
            ]);
            $audit->handle($request->user(), $job, 'dispatch.created', null, $job->toArray());
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was created.",
        ]);
    }

    public function show(int $dispatchJob): JsonResponse
    {
        $job = DispatchJob::query()->visibleTo(request()->user())->with(['personnelAssignments.user', 'assetAssignments.asset', 'approvals'])->findOrFail($dispatchJob);
        Gate::authorize('view', $job);

        return response()->json(['data' => $job]);
    }
}
