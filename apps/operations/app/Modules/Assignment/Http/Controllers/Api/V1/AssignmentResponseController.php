<?php

namespace App\Modules\Assignment\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Actions\RespondToDispatchAssignment;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Http\Requests\RespondToDispatchAssignmentRequest;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Http\Resources\V1\DispatchJobResource;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class AssignmentResponseController extends Controller
{
    public function store(
        RespondToDispatchAssignmentRequest $request,
        DispatchJob $dispatchJob,
        DispatchPersonnelAssignment $assignment,
        RespondToDispatchAssignment $action,
        IdempotentCommandService $idempotency,
        DispatchV2Commands $commands,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $dispatchJob, $assignment, $action, $commands, $commandId): JsonResponse {
            $expectedVersion = (int) $request->validated('version');
            $responseType = AssignmentResponse::from($request->validated('response'));
            $attempt = $this->resolveV2Attempt($dispatchJob);

            $offer = $attempt?->offers()->where('legacy_assignment_id', $assignment->id)->first()
                ?? $attempt?->offers()->where('user_id', $assignment->user_id)->first();

            if (config('dispatch.v2_commands_enabled') && $attempt !== null && $offer !== null) {
                $mutation = DispatchV2Mutation::forVersion(
                    expectedVersion: $expectedVersion,
                    idempotencyKey: $commandId,
                    reason: $request->validated('reason'),
                );

                try {
                    if ($responseType === AssignmentResponse::Accepted) {
                        $commands->acceptOffer($request->user(), $offer, $mutation);
                    } else {
                        $commands->rejectOffer($request->user(), $offer, $mutation);
                    }
                } catch (DispatchV2CommandException $e) {
                    $this->handleV2CommandException($e, $dispatchJob, $attempt, $request, $expectedVersion);
                }

                $assignment->update([
                    'response_status' => $responseType,
                    'responded_at' => now(),
                    'response_reason' => $request->validated('reason'),
                ]);
                $dispatchJob->update(['version' => $attempt->fresh()->version]);
            } else {
                try {
                    $action->handle(
                        $request->user(),
                        $dispatchJob,
                        $assignment,
                        $responseType,
                        $request->validated('reason'),
                        $expectedVersion,
                    );
                } catch (ValidationException $e) {
                    if (isset($e->errors()['version'])) {
                        $freshJob = DispatchJob::query()->find($dispatchJob->id);

                        if ($freshJob !== null) {
                            $freshJob->load($this->assignmentRelations($request->user()));
                        }

                        throw new VersionConflictException(
                            $e->getMessage(),
                            $freshJob ? $freshJob->version : $expectedVersion,
                            $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                        );
                    }

                    throw $e;
                }
            }

            $freshJob = DispatchJob::query()
                ->with($this->assignmentRelations($request->user()))
                ->findOrFail($dispatchJob->id);

            $response = response()->json(['data' => new DispatchJobResource($freshJob)]);
            $this->addDeprecationHeaders($response, $dispatchJob);

            return $response;
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

    private function resolveV2Attempt(DispatchJob $job): ?DispatchExecutionAttempt
    {
        return $job->canonicalHandoff?->attempts()->latest('attempt_number')->first()
            ?? $job->currentAttempt
            ?? $job->attempts()->latest('attempt_number')->first();
    }

    private function addDeprecationHeaders(JsonResponse $response, ?DispatchJob $job = null): void
    {
        $response->headers->set('Deprecation', '@1755129600');
        $response->headers->set('Sunset', 'Sun, 14 Feb 2027 00:00:00 GMT');
        if ($job !== null) {
            $response->headers->set('Link', '</api/v2/dispatch-jobs/'.$job->id.'>; rel="successor-version"');
        } else {
            $response->headers->set('Link', '</api/v2/dispatch-jobs>; rel="successor-version"');
        }
    }

    private function handleV2CommandException(
        DispatchV2CommandException $e,
        DispatchJob $dispatchJob,
        DispatchExecutionAttempt $attempt,
        Request $request,
        int $expectedVersion,
    ): never {
        if ($e->getErrorCode() === DispatchV2CommandCode::StaleVersion) {
            $freshJob = DispatchJob::query()->find($dispatchJob->id);
            if ($freshJob !== null) {
                $freshJob->load($this->assignmentRelations($request->user()));
            }

            throw new VersionConflictException(
                $e->getMessage(),
                $attempt->fresh()->version,
                $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
            );
        }

        if ($e->getErrorCode() === DispatchV2CommandCode::Forbidden) {
            abort(403, $e->getMessage());
        }

        throw ValidationException::withMessages([
            'response' => [$e->getMessage()],
        ]);
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
}
