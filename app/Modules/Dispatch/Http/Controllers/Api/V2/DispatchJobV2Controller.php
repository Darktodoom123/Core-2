<?php

namespace App\Modules\Dispatch\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Http\Requests\Api\V2\ArchiveDispatchJobV2Request;
use App\Modules\Dispatch\Http\Requests\Api\V2\CancelDispatchJobV2Request;
use App\Modules\Dispatch\Http\Requests\Api\V2\DispatchV2ActionRequest;
use App\Modules\Dispatch\Http\Requests\Api\V2\ProgressDispatchJobV2Request;
use App\Modules\Dispatch\Http\Requests\Api\V2\ReopenDispatchJobV2Request;
use App\Modules\Dispatch\Http\Resources\V2\DispatchJobV2Resource;
use App\Modules\Dispatch\Http\Resources\V2\DispatchReadinessResource;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class DispatchJobV2Controller extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $actor */
        $actor = $request->user();

        $query = DispatchJob::query()
            ->with([
                'currentAttempt.designatedLeadOffer.user',
                'currentAttempt.activePlanVersion',
                'currentAttempt.offers.user',
                'attempts.designatedLeadOffer.user',
            ])
            ->latest('id');

        if ($actor->hasRole('driver') || $actor->hasRole('technician') || $actor->hasRole('operator')) {
            $query->where(function ($q) use ($actor) {
                $q->whereHas('personnelAssignments', function ($aq) use ($actor) {
                    $aq->where('user_id', $actor->id);
                })->orWhereHas('attempts.offers', function ($oq) use ($actor) {
                    $oq->where('user_id', $actor->id);
                });
            });
        }

        $jobs = $query->paginate(25);

        return DispatchJobV2Resource::collection($jobs);
    }

    public function show(Request $request, DispatchJob $dispatchJob, DispatchV2Commands $commands): DispatchJobV2Resource
    {
        /** @var User $actor */
        $actor = $request->user();

        $this->authorizeView($actor, $dispatchJob);

        $attempt = $this->resolveAttempt($dispatchJob);
        $readiness = null;

        if ($attempt !== null) {
            try {
                $readiness = $commands->readiness($actor, $attempt);
            } catch (\Throwable) {
                // Return resource without readiness if query fails
            }
        }

        return (new DispatchJobV2Resource($dispatchJob->load([
            'currentAttempt.designatedLeadOffer.user',
            'currentAttempt.activePlanVersion.approvals',
            'currentAttempt.offers.user',
        ])))->additional(['readiness' => $readiness]);
    }

    public function readiness(Request $request, DispatchJob $dispatchJob, DispatchV2Commands $commands): DispatchReadinessResource
    {
        /** @var User $actor */
        $actor = $request->user();

        $this->authorizeView($actor, $dispatchJob);

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null) {
            abort(404, 'No execution attempt found for dispatch job.');
        }

        $readiness = $commands->readiness($actor, $attempt);
        $plan = $attempt->activePlanVersion ?? $attempt->planVersions()->latest('version')->first();

        return (new DispatchReadinessResource($readiness))->additional([
            'plan_status' => $plan !== null ? $plan->status->value : null,
        ]);
    }

    public function dispatch(
        DispatchV2ActionRequest $request,
        DispatchJob $dispatchJob,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null) {
            abort(404, 'No execution attempt found for dispatch job.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.dispatch';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $commands->dispatch($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return (new DispatchJobV2Resource($dispatchJob->fresh([
                'currentAttempt.designatedLeadOffer.user',
                'currentAttempt.activePlanVersion',
                'currentAttempt.offers.user',
            ])))->response();
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function progress(
        ProgressDispatchJobV2Request $request,
        DispatchJob $dispatchJob,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null) {
            abort(404, 'No execution attempt found for dispatch job.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.progress';
        $expectedVersion = (int) $request->validated('version');
        $nextStatus = DispatchAttemptStatus::from((string) $request->validated('status'));

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $nextStatus, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $commands->progress($actor, $attempt, $nextStatus, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return (new DispatchJobV2Resource($dispatchJob->fresh([
                'currentAttempt.designatedLeadOffer.user',
                'currentAttempt.activePlanVersion',
                'currentAttempt.offers.user',
            ])))->response();
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function cancel(
        CancelDispatchJobV2Request $request,
        DispatchJob $dispatchJob,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null) {
            abort(404, 'No execution attempt found for dispatch job.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.cancel';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: (string) $request->validated('reason'),
            );

            try {
                $commands->cancel($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return (new DispatchJobV2Resource($dispatchJob->fresh([
                'currentAttempt.designatedLeadOffer.user',
                'currentAttempt.activePlanVersion',
                'currentAttempt.offers.user',
            ])))->response();
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function reopen(
        ReopenDispatchJobV2Request $request,
        DispatchJob $dispatchJob,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null) {
            abort(404, 'No execution attempt found for dispatch job.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.reopen';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $commands->reopen($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return (new DispatchJobV2Resource($dispatchJob->fresh([
                'currentAttempt.designatedLeadOffer.user',
                'currentAttempt.activePlanVersion',
                'currentAttempt.offers.user',
            ])))->response();
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function archive(
        ArchiveDispatchJobV2Request $request,
        DispatchJob $dispatchJob,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null) {
            abort(404, 'No execution attempt found for dispatch job.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.archive';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $commands->archive($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return (new DispatchJobV2Resource($dispatchJob->fresh([
                'currentAttempt.designatedLeadOffer.user',
                'currentAttempt.activePlanVersion',
                'currentAttempt.offers.user',
            ])))->response();
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    private function resolveAttempt(DispatchJob $job): ?DispatchExecutionAttempt
    {
        return $job->canonicalHandoff?->attempts()->latest('attempt_number')->first()
            ?? $job->currentAttempt
            ?? $job->attempts()->latest('attempt_number')->first();
    }

    private function authorizeView(User $actor, DispatchJob $job): void
    {
        if ($actor->hasRole('driver') || $actor->hasRole('technician') || $actor->hasRole('operator')) {
            $isAssigned = $job->personnelAssignments()->where('user_id', $actor->id)->exists()
                || $job->attempts()->whereHas('offers', fn ($q) => $q->where('user_id', $actor->id))->exists();

            if (! $isAssigned) {
                abort(404, 'Dispatch job not found.');
            }
        }
    }

    private function handleCommandException(
        DispatchV2CommandException $e,
        DispatchExecutionAttempt $attempt,
        DispatchJob $job
    ): never {
        if ($e->getErrorCode() === DispatchV2CommandCode::NotReady) {
            throw ValidationException::withMessages([
                'readiness' => [$e->getMessage()],
            ]);
        }

        if ($e->getErrorCode() === DispatchV2CommandCode::StaleVersion) {
            throw new VersionConflictException(
                $e->getMessage(),
                $attempt->fresh()->version,
                (new DispatchJobV2Resource($job->fresh()))->resolve()
            );
        }

        if ($e->getErrorCode() === DispatchV2CommandCode::Forbidden) {
            abort(403, $e->getMessage());
        }

        abort($e->status, $e->getMessage());
    }
}
