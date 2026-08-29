<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;

final class DispatchLeadCommandService
{
    public function __construct(
        private readonly DispatchV2TransactionEnvelope $transactions,
    ) {}

    public function designate(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->setLead($actor, $attempt, $mutation, false);
    }

    public function replace(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->setLead($actor, $attempt, $mutation, true);
    }

    private function setLead(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation, bool $replacement): DispatchExecutionAttempt
    {
        $this->transactions->assertPhase3Enabled();
        $this->requireReason($mutation);
        $offerId = $this->positiveInt($mutation->payload['offer_id'] ?? null);
        $attemptId = $attempt instanceof DispatchExecutionAttempt ? (int) $attempt->id : $attempt;

        $result = $this->transactions->runForAttempt(
            $actor,
            $attemptId,
            $mutation,
            'dispatch.v2.lead.'.($replacement ? 'replace' : 'designate').':'.$offerId,
            $replacement ? 'replace_lead' : 'designate_lead',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation, $offerId, $replacement): DispatchExecutionAttempt {
                $plan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->lockForUpdate()->first();
                $offer = DispatchAssignmentOffer::query()
                    ->whereKey($offerId)
                    ->where('attempt_id', $lockedAttempt->id)
                    ->where('workspace_key', $lockedAttempt->workspace_key)
                    ->lockForUpdate()
                    ->first();
                if (! $plan instanceof DispatchPlanVersion || ! $offer instanceof DispatchAssignmentOffer || $offer->plan_version_id !== $plan->id) {
                    throw $this->notFound('The requested lead offer is not available.');
                }
                if ($offer->status !== DispatchAssignmentOfferStatus::Accepted) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'Only an accepted offer can be designated as lead.', status: 422);
                }

                $currentId = $lockedAttempt->designated_lead_offer_id === null ? null : (int) $lockedAttempt->designated_lead_offer_id;
                if (! $replacement && $currentId !== null && $currentId !== $offer->id) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'A different accepted lead is already designated; use explicit replacement.', status: 409);
                }
                if ($replacement && $currentId === null) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'Lead replacement requires an existing designated lead.', status: 409);
                }
                if ($currentId === $offer->id) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'That offer is already the designated lead.', status: 409);
                }

                $user = User::query()->whereKey($offer->user_id)->with([
                    'roles:id,name',
                    'personnelProfile',
                    'personnelCredentials',
                    'dispatchAssignments' => fn ($assignmentQuery) => $assignmentQuery->whereNull('active_until')->with('job'),
                ])->lockForUpdate()->first();
                if (! $user instanceof User || ! $this->eligible($user, (string) $offer->assignment_type, $plan, $lockedAttempt)) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'The proposed lead is not currently eligible for this dispatch.', status: 422);
                }

                $before = [
                    'designated_lead_offer_id' => $currentId,
                    'version' => $lockedAttempt->version,
                ];
                $lockedAttempt->update([
                    'designated_lead_offer_id' => $offer->id,
                    'lead_designated_by' => $actor->id,
                    'lead_designated_at' => now(),
                    'lead_designation_reason' => trim((string) $mutation->reason),
                    'version' => $lockedAttempt->version + 1,
                ]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.lead.'.($replacement ? 'replaced' : 'designated'),
                    $before,
                    ['designated_lead_offer_id' => $offer->id, 'version' => $lockedAttempt->version],
                    $mutation->reason,
                    $plan->id,
                    $offer->id,
                    null,
                    $offer,
                );

                return $lockedAttempt;
            },
            fn (array $payload): DispatchExecutionAttempt => $this->replayAttempt($payload, $mutation->workspaceKey),
        );

        return $result;
    }

    private function eligible(User $user, string $assignmentType, DispatchPlanVersion $plan, DispatchExecutionAttempt $attempt): bool
    {
        if (! $user->is_active || $user->suspended_at !== null) {
            return false;
        }
        $profile = $user->getRelationValue('personnelProfile');
        if ($profile instanceof PersonnelProfile && in_array($profile->availability_status, ['unavailable', 'on_leave'], true)) {
            return false;
        }
        $roleOkay = match ($assignmentType) {
            'crane_operator', 'operator', 'lead', 'foreman', 'driver' => $user->hasRole(RoleName::CraneOperator->value) || $user->hasRole(RoleName::FieldForeman->value),
            default => false,
        };
        if (! $roleOkay) {
            return false;
        }
        $kind = match ($assignmentType) {
            'driver' => 'driver_license',
            'crane_operator' => 'operator_certification',
            default => null,
        };
        if ($kind === null) {
            return ! $this->hasScheduleConflict($user, $attempt);
        }
        $at = $plan->scheduled_start ?? now();

        $credentialValid = $user->personnelCredentials->where('kind', $kind)->contains(static fn (PersonnelCredential $credential): bool => $credential->status === 'active'
            && ($credential->issued_at === null || $credential->issued_at->lte($at))
            && ($credential->expires_at === null || $credential->expires_at->gte($at->toDateString())));

        return $credentialValid && ! $this->hasScheduleConflict($user, $attempt);
    }

    private function hasScheduleConflict(User $user, DispatchExecutionAttempt $attempt): bool
    {
        foreach ($user->dispatchAssignments as $assignment) {
            $job = $assignment->job;
            if ($job->id === $attempt->legacy_dispatch_job_id) {
                continue;
            }
            if ($attempt->scheduled_start === null || $attempt->scheduled_end === null || $job->scheduled_start === null || $job->scheduled_end === null) {
                return true;
            }
            if ($job->scheduled_start->lt($attempt->scheduled_end) && $job->scheduled_end->gt($attempt->scheduled_start)) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $payload */
    private function replayAttempt(array $payload, string $workspaceKey): DispatchExecutionAttempt
    {
        $id = $payload['resource_id'] ?? null;
        $attempt = is_numeric($id)
            ? DispatchExecutionAttempt::query()->whereKey((int) $id)->where('workspace_key', $workspaceKey)->first()
            : null;
        if (! $attempt instanceof DispatchExecutionAttempt) {
            throw $this->notFound('The requested dispatch is not available.');
        }

        return $attempt;
    }

    private function positiveInt(mixed $value): int
    {
        if ((! is_int($value) && ! (is_string($value) && ctype_digit($value))) || (int) $value < 1) {
            throw $this->invalid('offer_id must be a positive integer.');
        }

        return (int) $value;
    }

    private function requireReason(DispatchV2Mutation $mutation): void
    {
        if ($mutation->reason === null || trim($mutation->reason) === '' || strlen($mutation->reason) > 1000) {
            throw $this->invalid('A lead designation reason is required.');
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
}
