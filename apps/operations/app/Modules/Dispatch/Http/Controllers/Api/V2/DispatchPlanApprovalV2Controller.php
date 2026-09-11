<?php

namespace App\Modules\Dispatch\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Http\Requests\Api\V2\DecideEmergencyOverrideV2Request;
use App\Modules\Dispatch\Http\Requests\Api\V2\DecidePlanApprovalV2Request;
use App\Modules\Dispatch\Http\Requests\Api\V2\ProposeEmergencyOverrideV2Request;
use App\Modules\Dispatch\Http\Requests\Api\V2\SubmitPlanV2Request;
use App\Modules\Dispatch\Http\Resources\V2\DispatchEmergencyOverrideResource;
use App\Modules\Dispatch\Http\Resources\V2\DispatchJobV2Resource;
use App\Modules\Dispatch\Http\Resources\V2\DispatchPlanApprovalResource;
use App\Modules\Dispatch\Http\Resources\V2\DispatchPlanVersionResource;
use App\Modules\Dispatch\Models\DispatchEmergencyOverride;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class DispatchPlanApprovalV2Controller extends Controller
{
    public function submitPlan(
        SubmitPlanV2Request $request,
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
        $actionName = 'dispatch_v2.plan.submit';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
                payload: ['snapshot' => (array) $request->validated('snapshot')],
            );

            try {
                $plan = $commands->submitPlan($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'plan' => (new DispatchPlanVersionResource($plan->load('approvals')))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function approvePlan(
        DecidePlanApprovalV2Request $request,
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
        $actionName = 'dispatch_v2.plan.approve';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $approval = $commands->approvePlan($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'approval' => (new DispatchPlanApprovalResource($approval))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function rejectPlan(
        DecidePlanApprovalV2Request $request,
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
        $actionName = 'dispatch_v2.plan.reject';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $approval = $commands->rejectPlan($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'approval' => (new DispatchPlanApprovalResource($approval))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function proposeEmergencyOverride(
        ProposeEmergencyOverrideV2Request $request,
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
        $actionName = 'dispatch_v2.override.propose';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: (string) $request->validated('reason'),
                payload: ['override_type' => (string) $request->validated('override_type')],
            );

            try {
                $override = $commands->proposeEmergencyOverride($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'override' => (new DispatchEmergencyOverrideResource($override))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function decideEmergencyOverride(
        DecideEmergencyOverrideV2Request $request,
        DispatchJob $dispatchJob,
        DispatchEmergencyOverride $override,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null || $override->attempt_id !== $attempt->id) {
            abort(404, 'Emergency override not found for this dispatch job attempt.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.override.decide';
        $expectedVersion = (int) $request->validated('version');
        $status = (string) $request->validated('status');

        $execute = function () use ($actor, $attempt, $dispatchJob, $override, $commands, $expectedVersion, $commandId, $status, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                if ($status === 'approved') {
                    $decided = $commands->approveEmergencyOverride($actor, $override, $mutation);
                } else {
                    $decided = $commands->rejectEmergencyOverride($actor, $override, $mutation);
                }
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'override' => (new DispatchEmergencyOverrideResource($decided))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
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

    private function handleCommandException(
        DispatchV2CommandException $e,
        DispatchExecutionAttempt $attempt,
        DispatchJob $job
    ): never {
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
