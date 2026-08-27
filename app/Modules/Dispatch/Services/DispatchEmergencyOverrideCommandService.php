<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Data\DispatchReadinessBlocker;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchEmergencyOverrideStatus;
use App\Modules\Dispatch\Enums\DispatchReadinessSeverity;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchEmergencyOverride;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

final class DispatchEmergencyOverrideCommandService
{
    /** @var list<string> */
    private const ALLOWED_BLOCKERS = [
        'missing_mandatory_assignment',
        'pending_mandatory_acceptance',
    ];

    public function __construct(private readonly DispatchV2TransactionEnvelope $transactions) {}

    public function propose(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchEmergencyOverride
    {
        $this->transactions->assertPhase3Enabled();
        $result = $this->transactions->runForAttempt(
            $actor,
            $attempt,
            $mutation,
            'dispatch.v2.emergency_override.propose',
            'emergency_propose',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation): DispatchEmergencyOverride {
                $plan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->lockForUpdate()->first();
                if (! $plan instanceof DispatchPlanVersion) {
                    throw $this->invalid('An active plan version is required for an emergency override.');
                }
                $planVersionId = $mutation->payload['plan_version_id'] ?? $plan->id;
                if (! is_numeric($planVersionId) || (int) $planVersionId !== $plan->id) {
                    throw $this->invalid('The emergency override must target the current plan version.');
                }
                $scope = $this->scope($mutation->payload['blocker_codes'] ?? null);
                $expiresAt = $this->expiry($mutation->payload['expires_at'] ?? null);
                $this->requireReason($mutation, 'A bounded emergency request reason is required.');
                $override = DispatchEmergencyOverride::query()->create([
                    'attempt_id' => $lockedAttempt->id,
                    'plan_version_id' => $plan->id,
                    'workspace_key' => $lockedAttempt->workspace_key,
                    'kind' => 'readiness_exception',
                    'scope' => $scope,
                    'status' => DispatchEmergencyOverrideStatus::Proposed,
                    'requested_by' => $actor->id,
                    'request_reason' => trim((string) $mutation->reason),
                    'expires_at' => $expiresAt,
                    'idempotency_key_id' => $lockedAttempt->v2IdempotencyKeyId,
                ]);
                $before = ['status' => null, 'version' => $lockedAttempt->version];
                $lockedAttempt->update(['version' => $lockedAttempt->version + 1]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.emergency_override.proposed',
                    $before,
                    ['override_id' => $override->id, 'status' => $override->status->value, 'plan_version_id' => $plan->id, 'version' => $lockedAttempt->version],
                    $mutation->reason,
                    $plan->id,
                    null,
                    null,
                    $override,
                    $override->id,
                );

                return $override->refresh();
            },
            fn (array $payload): DispatchEmergencyOverride => $this->replay($payload, $mutation->workspaceKey),
        );

        return $this->asOverride($result);
    }

    public function decide(User $actor, DispatchEmergencyOverride|int $override, DispatchV2Mutation $mutation, bool $approve): DispatchEmergencyOverride
    {
        $this->transactions->assertPhase3Enabled();
        $overrideId = $override instanceof DispatchEmergencyOverride ? (int) $override->id : $override;
        $attemptId = $override instanceof DispatchEmergencyOverride ? (int) $override->attempt_id : $this->attemptId($overrideId);
        $this->requireReason($mutation, 'A bounded emergency decision reason is required.');
        $result = $this->transactions->runForAttempt(
            $actor,
            $attemptId,
            $mutation,
            'dispatch.v2.emergency_override.'.($approve ? 'approve' : 'reject').':'.$overrideId,
            'emergency_decide',
            function (DispatchExecutionAttempt $lockedAttempt) use ($actor, $mutation, $approve, $overrideId): DispatchEmergencyOverride {
                $override = DispatchEmergencyOverride::query()
                    ->whereKey($overrideId)
                    ->where('attempt_id', $lockedAttempt->id)
                    ->where('workspace_key', $lockedAttempt->workspace_key)
                    ->lockForUpdate()
                    ->first();
                if (! $override instanceof DispatchEmergencyOverride) {
                    throw $this->notFound('The requested emergency override is not available.');
                }
                $canSelfApprove = $actor->hasAnyRole([
                    RoleName::SystemAdministrator->value,
                    RoleName::OperationsManager->value,
                ]);

                if (! $canSelfApprove && $override->requested_by === $actor->id) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::Forbidden, 'The requester cannot decide the emergency override.', status: 403);
                }
                if ($override->status !== DispatchEmergencyOverrideStatus::Proposed) {
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidTransition, 'The emergency override is no longer awaiting a decision.');
                }
                if ($override->expires_at->isPast()) {
                    $override->update(['status' => DispatchEmergencyOverrideStatus::Expired]);
                    throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidTransition, 'The emergency override has expired.');
                }
                $plan = $lockedAttempt->planVersions()->orderByDesc('version')->orderByDesc('id')->first();
                if (! $plan instanceof DispatchPlanVersion || $plan->id !== $override->plan_version_id) {
                    throw $this->invalid('The emergency override is stale for the current plan version.');
                }

                $before = ['status' => $override->status->value, 'decided_by' => null];
                $override->update([
                    'status' => $approve ? DispatchEmergencyOverrideStatus::Approved : DispatchEmergencyOverrideStatus::Rejected,
                    'decided_by' => $actor->id,
                    'decision_reason' => trim((string) $mutation->reason),
                    'decided_at' => now(),
                ]);
                $lockedAttempt->update(['version' => $lockedAttempt->version + 1]);
                $lockedAttempt->refresh();
                $this->transactions->recordMutation(
                    $actor,
                    $lockedAttempt,
                    'dispatch.v2.emergency_override.'.($approve ? 'approved' : 'rejected'),
                    $before,
                    ['override_id' => $override->id, 'status' => $override->status->value, 'decided_by' => $actor->id, 'version' => $lockedAttempt->version],
                    $mutation->reason,
                    $override->plan_version_id,
                    null,
                    null,
                    $override,
                    $override->id,
                );

                return $override->refresh();
            },
            fn (array $payload): DispatchEmergencyOverride => $this->replay($payload, $mutation->workspaceKey),
        );

        return $this->asOverride($result);
    }

    /**
     * @param  list<DispatchReadinessBlocker>  $blockers
     */
    public function usableFor(DispatchExecutionAttempt $attempt, int $planVersionId, array $blockers): ?DispatchEmergencyOverride
    {
        $override = DispatchEmergencyOverride::query()
            ->where('attempt_id', $attempt->id)
            ->where('workspace_key', $attempt->workspace_key)
            ->where('plan_version_id', $planVersionId)
            ->where('status', DispatchEmergencyOverrideStatus::Approved)
            ->whereNull('consumed_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->first();
        if (! $override instanceof DispatchEmergencyOverride) {
            return null;
        }
        if ($override->expires_at->isPast()) {
            $override->update(['status' => DispatchEmergencyOverrideStatus::Expired]);

            return null;
        }

        $allowed = $override->scope['blocker_codes'] ?? [];
        if (! is_array($allowed)) {
            return null;
        }
        $allowed = array_values(array_intersect(self::ALLOWED_BLOCKERS, array_map('strval', $allowed)));
        if ($allowed === []) {
            return null;
        }
        foreach ($blockers as $blocker) {
            if ($blocker->severity === DispatchReadinessSeverity::Blocking && ! in_array($blocker->code->value, $allowed, true)) {
                return null;
            }
        }

        return $override;
    }

    public function consume(DispatchEmergencyOverride $override): void
    {
        $override->update(['status' => DispatchEmergencyOverrideStatus::Consumed, 'consumed_at' => now()]);
    }

    /** @return array{blocker_codes: list<string>} */
    private function scope(mixed $codes): array
    {
        if (! is_array($codes) || $codes === []) {
            throw $this->invalid('At least one emergency blocker scope is required.');
        }
        $codes = array_values(array_unique(array_map('strval', $codes)));
        if (array_diff($codes, self::ALLOWED_BLOCKERS) !== []) {
            throw new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, 'Emergency overrides cannot waive lead, personnel, asset, approval, or source safety blockers.', status: 422);
        }

        return ['blocker_codes' => $codes];
    }

    private function expiry(mixed $value): Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            throw $this->invalid('An emergency override expiry is required.');
        }
        try {
            $expiry = Carbon::parse($value);
        } catch (\Throwable) {
            throw $this->invalid('The emergency override expiry is invalid.');
        }
        if ($expiry->lte(now()) || $expiry->gt(now()->addHours(24))) {
            throw $this->invalid('Emergency override expiry must be within 24 hours.');
        }

        return $expiry;
    }

    private function requireReason(DispatchV2Mutation $mutation, string $message): void
    {
        if ($mutation->reason === null || trim($mutation->reason) === '' || strlen($mutation->reason) > 1000) {
            throw $this->invalid($message);
        }
    }

    private function attemptId(int $overrideId): int
    {
        $attemptId = DispatchEmergencyOverride::query()->whereKey($overrideId)->value('attempt_id');
        if (! is_numeric($attemptId)) {
            throw $this->notFound('The requested emergency override is not available.');
        }

        return (int) $attemptId;
    }

    /** @param array<string, mixed> $payload */
    private function replay(array $payload, string $workspaceKey): DispatchEmergencyOverride
    {
        $id = $payload['resource_id'] ?? null;
        $override = is_numeric($id)
            ? DispatchEmergencyOverride::query()->whereKey((int) $id)->where('workspace_key', $workspaceKey)->first()
            : null;
        if (! $override instanceof DispatchEmergencyOverride) {
            throw $this->notFound('The requested emergency override is not available.');
        }

        return $override;
    }

    private function invalid(string $message): DispatchV2CommandException
    {
        return new DispatchV2CommandException(DispatchV2CommandCode::InvalidCommand, $message, status: 422);
    }

    private function notFound(string $message): DispatchV2CommandException
    {
        return new DispatchV2CommandException(DispatchV2CommandCode::ObjectNotFound, $message, status: 404);
    }

    private function asOverride(Model $result): DispatchEmergencyOverride
    {
        return $result instanceof DispatchEmergencyOverride ? $result : throw $this->invalid('The command returned an invalid emergency override.');
    }
}
