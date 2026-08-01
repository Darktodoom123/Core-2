<?php

namespace App\Modules\Dispatch\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Actions\RespondToDispatchAssignment;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Http\Requests\RespondToDispatchAssignmentRequest;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Actions\TransitionDispatchJob;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Http\Requests\TransitionDispatchJobRequest;
use App\Modules\Dispatch\Http\Resources\V1\DispatchJobResource;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Http\Exceptions\VersionConflictException;
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
            ->with($this->assignmentRelations($user))
            ->latest('scheduled_start')
            ->paginate(25);

        return DispatchJobResource::collection($jobs)->response();
    }

    public function show(Request $request, DispatchJob $dispatchJob): JsonResponse
    {
        abort_unless(Gate::forUser($request->user())->allows('viewAssigned', $dispatchJob), 404);

        $this->loadAssignmentRelations($dispatchJob, $request->user());

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
                    $freshJob = DispatchJob::query()->find($dispatchJob->id);

                    if ($freshJob !== null) {
                        $this->loadAssignmentRelations($freshJob, $request->user());
                    }

                    throw new VersionConflictException(
                        $e->getMessage(),
                        $freshJob ? $freshJob->version : (int) $request->validated('version'),
                        $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                    );
                }

                throw $e;
            }
        };

        $response = $idempotency->process(
            $request->user(),
            $commandId,
            'dispatch.assignment_response',
            (int) $request->validated('version'),
            $execute,
            [
                'dispatch_job_id' => $dispatchJob->id,
                'assignment_id' => $assignment->id,
                ...$request->validated(),
            ],
        );
        assert($response instanceof JsonResponse);

        return $response;
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

                $this->loadAssignmentRelations($updatedJob, $request->user());

                return response()->json(['data' => new DispatchJobResource($updatedJob)]);
            } catch (ValidationException $e) {
                if (isset($e->errors()['version'])) {
                    $freshJob = DispatchJob::query()->find($dispatchJob->id);

                    if ($freshJob !== null) {
                        $this->loadAssignmentRelations($freshJob, $request->user());
                    }

                    throw new VersionConflictException(
                        $e->getMessage(),
                        $freshJob ? $freshJob->version : (int) $request->validated('version'),
                        $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                    );
                }

                throw $e;
            }
        };

        $response = $idempotency->process(
            $request->user(),
            $commandId,
            'dispatch.status_transition',
            (int) $request->validated('version'),
            $execute,
            [
                'dispatch_job_id' => $dispatchJob->id,
                ...$request->validated(),
            ],
        );
        assert($response instanceof JsonResponse);

        return $response;
    }

    /**
     * @return array<string, \Closure>
     */
    private function assignmentRelations(User $user): array
    {
        $canViewAll = $user->can(PermissionName::DispatchViewAll->value);

        return [
            'personnelAssignments' => function ($query) use ($user, $canViewAll): void {
                $query->open()
                    ->when(! $canViewAll, fn ($query) => $query->where('user_id', $user->id))
                    ->with('user:id,name');
            },
            'assetAssignments' => fn ($query) => $query
                ->open()
                ->with('asset:id,code,name,kind'),
        ];
    }

    private function loadAssignmentRelations(DispatchJob $job, User $user): void
    {
        $job->load($this->assignmentRelations($user));
    }
}
