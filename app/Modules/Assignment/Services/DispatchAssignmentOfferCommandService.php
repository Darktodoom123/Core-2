<?php

namespace App\Modules\Assignment\Services;

use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Services\DispatchV2TransactionEnvelope;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;

final class DispatchAssignmentOfferCommandService
{
    public function __construct(
        private readonly DispatchV2TransactionEnvelope $transactions,
    ) {}

    public function propose(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        $this->transactions->assertPhase3Enabled();

        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.assignment_offer.propose',
            'offer_manage',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchAssignmentOffer {
                $userId = $this->positiveInt($mutation->payload['user_id'] ?? null, 'user_id');
                $assignmentType = $this->boundedString($mutation->payload['assignment_type'] ?? null, 'assignment_type', 32);
                $isMandatory = $mutation->payload['is_mandatory'] ?? false;
                if (! is_bool($isMandatory)) {
                    throw $this->invalid('is_mandatory must be boolean.');
                }

                $plan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->lockForUpdate()->first();
                if (! $plan instanceof DispatchPlanVersion || $plan->status->value === 'superseded') {
                    throw $this->invalid('An active plan version is required before creating an assignment offer.');
                }
                $requestedPlanId = $mutation->payload['plan_version_id'] ?? null;
                if ($requestedPlanId !== null && (int) $requestedPlanId !== $plan->id) {
                    throw $this->invalid('Assignment offers must target the current plan version.');
                }
                if (! User::query()->whereKey($userId)->exists()) {
                    throw $this->notFound('The selected personnel record is not available.');
                }

                $offer = DispatchAssignmentOffer::query()->create([
                    'attempt_id' => $lockedAttempt->id,
                    'plan_version_id' => $plan->id,
                    'workspace_key' => $lockedAttempt->workspace_key,
                    'user_id' => $userId,
                    'assignment_type' => $assignmentType,
                    'is_mandatory' => $isMandatory,
                    'status' => DispatchAssignmentOfferStatus::Proposed,
                    'created_by' => $actor->id,
                    'compatibility_state' => 'v2_command',
                ]);
                $before = ['status' => null, 'version' => $lockedAttempt->version];
                $lockedAttempt->update(['version' => $lockedAttempt->version + 1]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.assignment_offer.proposed',
                    $before,
                    ['offer_id' => $offer->id, 'status' => $offer->status->value, 'version' => $lockedAttempt->version],
                    $mutation->reason,
                    $plan->id,
                    $offer->id,
                    null,
                    $offer,
                );

                return $offer->refresh();
            },
            fn (array $payload): DispatchAssignmentOffer => $this->replayOffer($payload, $mutation->workspaceKey),
        );

        return $this->asOffer($result);
    }

    public function offer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->transition($actor, $offer, $mutation, DispatchAssignmentOfferStatus::Offered, 'offer', 'offer_manage');
    }

    public function accept(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->transition($actor, $offer, $mutation, DispatchAssignmentOfferStatus::Accepted, 'accept', 'offer_respond');
    }

    public function reject(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->transition($actor, $offer, $mutation, DispatchAssignmentOfferStatus::Rejected, 'reject', 'offer_respond');
    }

    public function withdraw(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->transition($actor, $offer, $mutation, DispatchAssignmentOfferStatus::Withdrawn, 'withdraw', 'offer_manage');
    }

    public function expire(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->transition($actor, $offer, $mutation, DispatchAssignmentOfferStatus::Expired, 'expire', 'offer_manage');
    }

    public function end(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->transition($actor, $offer, $mutation, DispatchAssignmentOfferStatus::Ended, 'end', 'offer_manage');
    }

    private function transition(
        User $actor,
        DispatchAssignmentOffer|int $offer,
        DispatchV2Mutation $mutation,
        DispatchAssignmentOfferStatus $target,
        string $verb,
        string $ability,
    ): DispatchAssignmentOffer {
        $this->transactions->assertPhase3Enabled();
        $offerId = $offer instanceof DispatchAssignmentOffer ? (int) $offer->getKey() : $offer;
        if (in_array($target, [DispatchAssignmentOfferStatus::Rejected, DispatchAssignmentOfferStatus::Withdrawn, DispatchAssignmentOfferStatus::Expired, DispatchAssignmentOfferStatus::Ended], true)) {
            $this->requireReason($mutation, $target === DispatchAssignmentOfferStatus::Rejected ? 'A rejection reason is required.' : 'A reason is required for this offer transition.');
        }

        $result = $this->transactions->runForAttempt(
            $actor,
            $offer instanceof DispatchAssignmentOffer ? $offer->attempt_id : $this->attemptId($offerId),
            $mutation,
            'dispatch.v2.assignment_offer.'.$verb.':'.$offerId,
            $ability,
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $offerId, $mutation, $target, $verb): DispatchAssignmentOffer {
                $offer = DispatchAssignmentOffer::query()
                    ->whereKey($offerId)
                    ->where('attempt_id', $lockedAttempt->id)
                    ->where('workspace_key', $lockedAttempt->workspace_key)
                    ->lockForUpdate()
                    ->first();
                if (! $offer instanceof DispatchAssignmentOffer) {
                    throw $this->notFound('The requested assignment offer is not available.');
                }

                if (in_array($verb, ['accept', 'reject'], true) && (int) $offer->user_id !== $actor->id) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::Forbidden, 'Only the offered personnel may respond to this offer.', status: 403);
                }

                $this->assertTransition($offer->status, $target);
                if ($verb === 'expire' && $offer->response_deadline !== null && $offer->response_deadline->isFuture()) {
                    throw $this->invalid('An offer cannot expire before its response deadline.');
                }
                if ($verb === 'accept' && $offer->response_deadline !== null && $offer->response_deadline->isPast()) {
                    throw $this->invalid('This offer has expired and cannot be accepted.');
                }

                $before = ['status' => $offer->status->value, 'version' => $lockedAttempt->version];
                $now = now();
                $attributes = [
                    'status' => $target,
                    'responded_at' => in_array($target, [DispatchAssignmentOfferStatus::Accepted, DispatchAssignmentOfferStatus::Rejected], true) ? $now : $offer->responded_at,
                    'response_reason' => $mutation->reason === null ? $offer->response_reason : trim($mutation->reason),
                ];
                match ($target) {
                    DispatchAssignmentOfferStatus::Offered => $attributes['offered_at'] = $now,
                    DispatchAssignmentOfferStatus::Accepted => $attributes['accepted_at'] = $now,
                    DispatchAssignmentOfferStatus::Rejected => $attributes['rejected_at'] = $now,
                    DispatchAssignmentOfferStatus::Withdrawn => $attributes['withdrawn_at'] = $now,
                    DispatchAssignmentOfferStatus::Expired => $attributes['expired_at'] = $now,
                    DispatchAssignmentOfferStatus::Ended => [$attributes['ended_at'] = $now, $attributes['ended_by'] = $actor->id, $attributes['ended_reason'] = trim((string) $mutation->reason)],
                    DispatchAssignmentOfferStatus::Proposed => null,
                };
                $offer->update($attributes);

                if (in_array($target, [DispatchAssignmentOfferStatus::Withdrawn, DispatchAssignmentOfferStatus::Expired, DispatchAssignmentOfferStatus::Ended], true)
                    && (int) $lockedAttempt->designated_lead_offer_id === $offer->id) {
                    $lockedAttempt->update([
                        'designated_lead_offer_id' => null,
                        'lead_designated_by' => null,
                        'lead_designated_at' => null,
                        'lead_designation_reason' => null,
                    ]);
                }
                $lockedAttempt->update(['version' => $lockedAttempt->version + 1]);
                $lockedAttempt->refresh();
                $action = 'dispatch.v2.assignment_offer.'.$target->value;
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    $action,
                    $before,
                    ['offer_id' => $offer->id, 'status' => $offer->status->value, 'version' => $lockedAttempt->version],
                    $mutation->reason,
                    $offer->plan_version_id,
                    $offer->id,
                    null,
                    $offer,
                );

                return $offer->refresh();
            },
            fn (array $payload): DispatchAssignmentOffer => $this->replayOffer($payload, $mutation->workspaceKey),
        );

        return $this->asOffer($result);
    }

    private function assertTransition(DispatchAssignmentOfferStatus $current, DispatchAssignmentOfferStatus $target): void
    {
        $allowed = match ($current) {
            DispatchAssignmentOfferStatus::Proposed => [$target === DispatchAssignmentOfferStatus::Offered],
            DispatchAssignmentOfferStatus::Offered => in_array($target, [DispatchAssignmentOfferStatus::Accepted, DispatchAssignmentOfferStatus::Rejected, DispatchAssignmentOfferStatus::Withdrawn, DispatchAssignmentOfferStatus::Expired], true),
            DispatchAssignmentOfferStatus::Accepted => in_array($target, [DispatchAssignmentOfferStatus::Withdrawn, DispatchAssignmentOfferStatus::Ended], true),
            DispatchAssignmentOfferStatus::Rejected, DispatchAssignmentOfferStatus::Withdrawn, DispatchAssignmentOfferStatus::Expired, DispatchAssignmentOfferStatus::Ended => false,
        };
        if (! $allowed) {
            throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidTransition, 'The assignment offer cannot make that transition.');
        }
    }

    private function attemptId(int $offerId): int
    {
        $attemptId = DispatchAssignmentOffer::query()->whereKey($offerId)->value('attempt_id');
        if (! is_numeric($attemptId)) {
            throw $this->notFound('The requested assignment offer is not available.');
        }

        return (int) $attemptId;
    }

    /** @param array<string, mixed> $payload */
    private function replayOffer(array $payload, string $workspaceKey): DispatchAssignmentOffer
    {
        $id = $payload['resource_id'] ?? null;
        $offer = is_numeric($id)
            ? DispatchAssignmentOffer::query()->whereKey((int) $id)->where('workspace_key', $workspaceKey)->first()
            : null;
        if (! $offer instanceof DispatchAssignmentOffer) {
            throw $this->notFound('The requested assignment offer is not available.');
        }

        return $offer;
    }

    private function positiveInt(mixed $value, string $field): int
    {
        if (! is_int($value) && ! (is_string($value) && ctype_digit($value))) {
            throw $this->invalid("{$field} must be a positive integer.");
        }
        $value = (int) $value;
        if ($value < 1) {
            throw $this->invalid("{$field} must be a positive integer.");
        }

        return $value;
    }

    private function boundedString(mixed $value, string $field, int $max): string
    {
        if (! is_string($value) || trim($value) === '' || strlen($value) > $max) {
            throw $this->invalid("{$field} is invalid.");
        }

        return trim($value);
    }

    private function requireReason(DispatchV2Mutation $mutation, string $message): void
    {
        if ($mutation->reason === null || trim($mutation->reason) === '' || strlen($mutation->reason) > 1000) {
            throw $this->invalid($message);
        }
    }

    private function invalid(string $message): DispatchV2CommandException
    {
        return new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, $message, status: 422);
    }

    private function notFound(string $message): DispatchV2CommandException
    {
        return new DispatchV2CommandException(DispatchV2CommandCode::ObjectNotFound, $message, status: 404);
    }

    private function asOffer(Model $result): DispatchAssignmentOffer
    {
        return $result instanceof DispatchAssignmentOffer
            ? $result
            : throw $this->invalid('The command returned an invalid assignment offer.');
    }
}
