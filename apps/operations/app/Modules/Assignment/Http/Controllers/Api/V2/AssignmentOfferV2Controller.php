<?php

namespace App\Modules\Assignment\Http\Controllers\Api\V2;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Http\Requests\Api\V2\DesignateLeadV2Request;
use App\Modules\Assignment\Http\Requests\Api\V2\ProposeAssignmentOfferV2Request;
use App\Modules\Assignment\Http\Requests\Api\V2\RespondAssignmentOfferV2Request;
use App\Modules\Assignment\Http\Requests\Api\V2\WithdrawAssignmentOfferV2Request;
use App\Modules\Assignment\Http\Resources\V2\DispatchAssignmentOfferResource;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Http\Resources\V2\DispatchJobV2Resource;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class AssignmentOfferV2Controller extends Controller
{
    public function propose(
        ProposeAssignmentOfferV2Request $request,
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
        $actionName = 'dispatch_v2.offer.propose';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
                payload: [
                    'user_id' => (int) $request->validated('user_id'),
                    'assignment_type' => (string) $request->validated('assignment_type'),
                    'is_mandatory' => (bool) $request->validated('is_mandatory', false),
                ],
            );

            try {
                $offer = $commands->proposeOffer($actor, $attempt, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'offer' => (new DispatchAssignmentOfferResource($offer->load('user')))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function accept(
        RespondAssignmentOfferV2Request $request,
        DispatchJob $dispatchJob,
        mixed $offer,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $offerModel = $this->resolveOffer($offer);
        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null || $offerModel->attempt_id !== $attempt->id) {
            abort(404, 'Offer not found for this dispatch job attempt.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.offer.accept';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $offerModel, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $updatedOffer = $commands->acceptOffer($actor, $offerModel, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'offer' => (new DispatchAssignmentOfferResource($updatedOffer->load('user')))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function reject(
        RespondAssignmentOfferV2Request $request,
        DispatchJob $dispatchJob,
        mixed $offer,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $offerModel = $this->resolveOffer($offer);
        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null || $offerModel->attempt_id !== $attempt->id) {
            abort(404, 'Offer not found for this dispatch job attempt.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.offer.reject';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $offerModel, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: (string) $request->validated('reason'),
            );

            try {
                $updatedOffer = $commands->rejectOffer($actor, $offerModel, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'offer' => (new DispatchAssignmentOfferResource($updatedOffer->load('user')))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function withdraw(
        WithdrawAssignmentOfferV2Request $request,
        DispatchJob $dispatchJob,
        mixed $offer,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $offerModel = $this->resolveOffer($offer);
        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null || $offerModel->attempt_id !== $attempt->id) {
            abort(404, 'Offer not found for this dispatch job attempt.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.offer.withdraw';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $offerModel, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $updatedOffer = $commands->withdrawOffer($actor, $offerModel, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'offer' => (new DispatchAssignmentOfferResource($updatedOffer->load('user')))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function expire(
        RespondAssignmentOfferV2Request $request,
        DispatchJob $dispatchJob,
        mixed $offer,
        DispatchV2Commands $commands,
        IdempotentCommandService $idempotency
    ): Response {
        /** @var User $actor */
        $actor = $request->user();

        $offerModel = $this->resolveOffer($offer);
        $attempt = $this->resolveAttempt($dispatchJob);
        if ($attempt === null || $offerModel->attempt_id !== $attempt->id) {
            abort(404, 'Offer not found for this dispatch job attempt.');
        }

        $commandId = $idempotency->resolveCommandId($request);
        $actionName = 'dispatch_v2.offer.expire';
        $expectedVersion = (int) $request->validated('version');

        $execute = function () use ($actor, $attempt, $dispatchJob, $offerModel, $commands, $expectedVersion, $commandId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason'),
            );

            try {
                $updatedOffer = $commands->expireOffer($actor, $offerModel, $mutation);
            } catch (DispatchV2CommandException $e) {
                $this->handleCommandException($e, $attempt, $dispatchJob);
            }

            return response()->json([
                'data' => [
                    'offer' => (new DispatchAssignmentOfferResource($updatedOffer->load('user')))->resolve(),
                    'job' => (new DispatchJobV2Resource($dispatchJob->fresh()))->resolve(),
                ],
            ]);
        };

        if ($commandId !== null) {
            return $idempotency->process($actor, $commandId, $actionName, $expectedVersion, $execute, $request->all());
        }

        return $execute();
    }

    public function designateLead(
        DesignateLeadV2Request $request,
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
        $actionName = 'dispatch_v2.lead.designate';
        $expectedVersion = (int) $request->validated('version');
        $offerId = (int) $request->validated('offer_id');

        $execute = function () use ($actor, $attempt, $dispatchJob, $commands, $expectedVersion, $commandId, $offerId, $request): JsonResponse {
            $mutation = DispatchV2Mutation::forVersion(
                expectedVersion: $expectedVersion,
                idempotencyKey: $commandId,
                reason: $request->validated('reason') ?? 'Designate lead driver',
                payload: ['offer_id' => $offerId],
            );

            try {
                if ($attempt->designated_lead_offer_id !== null) {
                    $commands->replaceLead($actor, $attempt, $mutation);
                } else {
                    $commands->designateLead($actor, $attempt, $mutation);
                }
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

    private function resolveOffer(mixed $offer): DispatchAssignmentOffer
    {
        if ($offer instanceof DispatchAssignmentOffer && $offer->exists) {
            return $offer;
        }

        $id = $offer instanceof DispatchAssignmentOffer ? (int) $offer->id : (int) $offer;

        /** @var DispatchAssignmentOffer $model */
        $model = DispatchAssignmentOffer::query()->whereKey($id)->firstOrFail();

        return $model;
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
