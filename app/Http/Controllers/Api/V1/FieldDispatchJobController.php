<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\RespondToDispatchAssignment;
use App\Actions\TransitionDispatchJob;
use App\Enums\AssignmentResponse;
use App\Enums\DispatchStatus;
use App\Exceptions\VersionConflictException;
use App\Http\Controllers\Controller;
use App\Http\Requests\RespondToDispatchAssignmentRequest;
use App\Http\Requests\TransitionDispatchJobRequest;
use App\Http\Resources\V1\DispatchJobResource;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Services\IdempotentCommandService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class FieldDispatchJobController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', DispatchJob::class);
        $user = $request->user();

        $jobs = DispatchJob::query()
            ->whereIn('id', DispatchPersonnelAssignment::query()
                ->open()
                ->where('user_id', $user->id)
                ->select('dispatch_job_id'))
            ->with([
                'personnelAssignments' => fn ($query) => $query
                    ->open()
                    ->with('user:id,name'),
                'assetAssignments' => fn ($query) => $query
                    ->open()
                    ->with('asset:id,code,name,kind'),
            ])
            ->latest('scheduled_start')
            ->paginate(25);

        return DispatchJobResource::collection($jobs)->response();
    }

    public function show(Request $request, DispatchJob $dispatchJob): JsonResponse
    {
        abort_unless(Gate::forUser($request->user())->allows('viewAssigned', $dispatchJob), 404);

        $dispatchJob->load([
            'personnelAssignments' => fn ($query) => $query
                ->open()
                ->with('user:id,name'),
            'assetAssignments' => fn ($query) => $query
                ->open()
                ->with('asset:id,code,name,kind'),
        ]);

        return response()->json(['data' => new DispatchJobResource($dispatchJob)]);
    }

    public function respondAssignment(
        RespondToDispatchAssignmentRequest $request,
        DispatchJob $dispatchJob,
        DispatchPersonnelAssignment $assignment,
        RespondToDispatchAssignment $action,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $dispatchJob, $assignment, $action): JsonResponse {
            try {
                $response = AssignmentResponse::from($request->validated('response'));
                $action->handle(
                    $request->user(),
                    $dispatchJob,
                    $assignment,
                    $response,
                    $request->validated('reason'),
                    (int) $request->validated('version'),
                );

                $freshJob = DispatchJob::query()
                    ->with([
                        'personnelAssignments' => fn ($query) => $query
                            ->open()
                            ->with('user:id,name'),
                        'assetAssignments' => fn ($query) => $query
                            ->open()
                            ->with('asset:id,code,name,kind'),
                    ])
                    ->findOrFail($dispatchJob->id);

                return response()->json(['data' => new DispatchJobResource($freshJob)]);
            } catch (ValidationException $e) {
                if (isset($e->errors()['version'])) {
                    $freshJob = DispatchJob::query()
                        ->with([
                            'personnelAssignments' => fn ($query) => $query
                                ->open()
                                ->with('user:id,name'),
                            'assetAssignments' => fn ($query) => $query
                                ->open()
                                ->with('asset:id,code,name,kind'),
                        ])
                        ->find($dispatchJob->id);

                    throw new VersionConflictException(
                        $e->getMessage(),
                        $freshJob ? $freshJob->version : (int) $request->validated('version'),
                        $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                    );
                }

                throw $e;
            }
        };

        /** @var JsonResponse */
        return $idempotency->process(
            $request->user(),
            $commandId,
            'dispatch.assignment_response',
            (int) $request->validated('version'),
            $execute,
            $request->validated(),
        );
    }

    public function transitionStatus(
        TransitionDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        TransitionDispatchJob $action,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $dispatchJob, $action): JsonResponse {
            try {
                $updatedJob = $action->handle(
                    $request->user(),
                    $dispatchJob,
                    DispatchStatus::from($request->validated('status')),
                    (int) $request->validated('version'),
                );

                $updatedJob->load([
                    'personnelAssignments' => fn ($query) => $query
                        ->open()
                        ->with('user:id,name'),
                    'assetAssignments' => fn ($query) => $query
                        ->open()
                        ->with('asset:id,code,name,kind'),
                ]);

                return response()->json(['data' => new DispatchJobResource($updatedJob)]);
            } catch (ValidationException $e) {
                if (isset($e->errors()['version'])) {
                    $freshJob = DispatchJob::query()
                        ->with([
                            'personnelAssignments' => fn ($query) => $query
                                ->open()
                                ->with('user:id,name'),
                            'assetAssignments' => fn ($query) => $query
                                ->open()
                                ->with('asset:id,code,name,kind'),
                        ])
                        ->find($dispatchJob->id);

                    throw new VersionConflictException(
                        $e->getMessage(),
                        $freshJob ? $freshJob->version : (int) $request->validated('version'),
                        $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                    );
                }

                throw $e;
            }
        };

        /** @var JsonResponse */
        return $idempotency->process(
            $request->user(),
            $commandId,
            'dispatch.status_transition',
            (int) $request->validated('version'),
            $execute,
            $request->validated(),
        );
    }
}
