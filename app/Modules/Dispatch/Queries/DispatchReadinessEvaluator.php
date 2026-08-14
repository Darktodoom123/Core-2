<?php

namespace App\Modules\Dispatch\Queries;

use App\Modules\Dispatch\Data\DispatchReadinessBlocker;
use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchReadinessBlockerCode;
use App\Modules\Dispatch\Enums\DispatchReadinessSeverity;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchPlanVersion;

final class DispatchReadinessEvaluator
{
    public function evaluate(
        DispatchExecutionAttempt $attempt,
        ?int $expectedVersion = null,
        bool $lock = false,
    ): DispatchReadinessProjection {
        $planQuery = DispatchPlanVersion::query()
            ->where('attempt_id', $attempt->id)
            ->orderByDesc('version')
            ->orderByDesc('id');

        if ($lock) {
            $planQuery->lockForUpdate();
        }

        $plan = $planQuery->first();
        $planVersion = $plan?->version;
        $snapshot = $plan === null ? [] : $plan->snapshot;
        $blockers = [];

        $scheduleStart = $plan === null ? $attempt->scheduled_start : ($plan->scheduled_start ?? $attempt->scheduled_start);
        $scheduleEnd = $plan === null ? $attempt->scheduled_end : ($plan->scheduled_end ?? $attempt->scheduled_end);
        $scheduled = $scheduleStart !== null && $scheduleEnd !== null && $scheduleEnd->greaterThan($scheduleStart);

        if (! $scheduled) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::MissingSchedule,
                ['has_start' => $scheduleStart !== null, 'has_end' => $scheduleEnd !== null, 'valid_interval' => false],
                $planVersion,
                $attempt->version,
            );
        }

        if ($plan === null) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::ApprovalRequired,
                ['current_plan_exists' => false],
                null,
                $attempt->version,
            );
        } else {
            $approvalQuery = $plan->approvals()->where('status', DispatchPlanApprovalStatus::Approved->value);
            if ($lock) {
                $approvalQuery->lockForUpdate();
            }
            $hasCurrentApproval = $approvalQuery->exists();

            if ($plan->status === DispatchPlanVersionStatus::Superseded) {
                $blockers[] = $this->blocking(
                    DispatchReadinessBlockerCode::StalePlanApproval,
                    ['plan_status' => $plan->status->value, 'current_plan_version' => $plan->version],
                    $planVersion,
                    $attempt->version,
                );
            } elseif ($plan->status !== DispatchPlanVersionStatus::Approved || ! $hasCurrentApproval) {
                $blockers[] = $this->blocking(
                    DispatchReadinessBlockerCode::ApprovalRequired,
                    ['plan_status' => $plan->status->value, 'has_current_approval' => $hasCurrentApproval],
                    $planVersion,
                    $attempt->version,
                );
            }
        }

        $offerQuery = DispatchAssignmentOffer::query()->where('attempt_id', $attempt->id);
        if ($plan !== null) {
            $offerQuery->where('plan_version_id', $plan->id);
        }
        if ($lock) {
            $offerQuery->lockForUpdate();
        }
        $offers = $offerQuery->get();
        $mandatoryOffers = $offers->where('is_mandatory', true)->values();
        $requiredAssignments = $this->requiredAssignments($snapshot);

        if ($mandatoryOffers->isEmpty() && $requiredAssignments > 0) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::MissingMandatoryAssignment,
                ['required_count' => $requiredAssignments, 'current_count' => 0],
                $planVersion,
                $attempt->version,
            );
        } elseif ($mandatoryOffers->contains(static fn (DispatchAssignmentOffer $offer): bool => $offer->status !== DispatchAssignmentOfferStatus::Accepted)) {
            $pendingCount = $mandatoryOffers->reject(
                static fn (DispatchAssignmentOffer $offer): bool => $offer->status === DispatchAssignmentOfferStatus::Accepted,
            )->count();
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::PendingMandatoryAcceptance,
                ['mandatory_count' => $mandatoryOffers->count(), 'pending_count' => $pendingCount],
                $planVersion,
                $attempt->version,
            );
        }

        $designatedOfferId = $attempt->getAttribute('designated_lead_offer_id');
        if (! is_numeric($designatedOfferId)) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::NoDesignatedLead,
                ['designated_lead_exists' => false],
                $planVersion,
                $attempt->version,
            );
        } else {
            $designatedOffer = $offers->firstWhere('id', (int) $designatedOfferId);
            if (! $designatedOffer instanceof DispatchAssignmentOffer
                || $designatedOffer->status !== DispatchAssignmentOfferStatus::Accepted) {
                $blockers[] = $this->blocking(
                    DispatchReadinessBlockerCode::LeadNotAccepted,
                    ['designated_lead_exists' => $designatedOffer instanceof DispatchAssignmentOffer, 'accepted' => false],
                    $planVersion,
                    $attempt->version,
                );
            }
        }

        $assetBlockers = $this->assetBlockers($snapshot, $planVersion, $attempt->version);
        array_push($blockers, ...$assetBlockers);

        $compatibilityState = (string) ($attempt->handoff->compatibility_state ?? '');
        if (in_array($compatibilityState, ['legacy_pending_reconciliation', 'source_not_ready', 'invalid_source'], true)) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::SourceNotReady,
                ['compatibility_state' => $compatibilityState],
                $planVersion,
                $attempt->version,
            );
        }

        if ($attempt->archived_at !== null) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::ArchivedRecord,
                ['archived' => true],
                $planVersion,
                $attempt->version,
            );
        }

        if ($expectedVersion !== null && $expectedVersion !== $attempt->version) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::ConcurrencyConflict,
                ['expected_version' => $expectedVersion, 'current_version' => $attempt->version],
                $planVersion,
                $attempt->version,
            );
        }

        usort($blockers, static fn (DispatchReadinessBlocker $left, DispatchReadinessBlocker $right): int => $left->code->order() <=> $right->code->order());
        $blocking = array_values(array_filter($blockers, static fn (DispatchReadinessBlocker $blocker): bool => $blocker->severity === DispatchReadinessSeverity::Blocking));
        $awaitingApproval = array_filter($blocking, static fn (DispatchReadinessBlocker $blocker): bool => in_array($blocker->code, [
            DispatchReadinessBlockerCode::ApprovalRequired,
            DispatchReadinessBlockerCode::StalePlanApproval,
        ], true)) !== [];
        $ready = $blocking === [];
        $labels = [];

        if ($scheduled) {
            $labels[] = 'scheduled';
        }
        if ($awaitingApproval) {
            $labels[] = 'awaiting_approval';
        }
        if ($ready) {
            $labels[] = 'ready';
        }

        return new DispatchReadinessProjection(
            $ready,
            $scheduled,
            $awaitingApproval,
            $labels,
            $blockers,
            $attempt->version,
            $planVersion,
        );
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return list<DispatchReadinessBlocker>
     */
    private function assetBlockers(array $snapshot, ?int $planVersion, int $attemptVersion): array
    {
        $assets = $snapshot['assets'] ?? [];
        if (! is_array($assets)) {
            return [];
        }

        $unavailable = 0;
        $unsafe = 0;
        foreach ($assets as $asset) {
            if (! is_array($asset)) {
                continue;
            }
            if (array_key_exists('available', $asset) && $asset['available'] === false) {
                $unavailable++;
            }
            if (array_key_exists('safe', $asset) && $asset['safe'] === false) {
                $unsafe++;
            }
        }

        $blockers = [];
        if ($unavailable > 0) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::AssetUnavailable,
                ['unavailable_count' => $unavailable],
                $planVersion,
                $attemptVersion,
            );
        }
        if ($unsafe > 0) {
            $blockers[] = $this->blocking(
                DispatchReadinessBlockerCode::AssetUnsafe,
                ['unsafe_count' => $unsafe],
                $planVersion,
                $attemptVersion,
            );
        }

        return $blockers;
    }

    /** @param array<string, mixed> $snapshot */
    private function requiredAssignments(array $snapshot): int
    {
        $required = $snapshot['mandatory_assignments'] ?? [];

        return is_array($required) ? count($required) : 0;
    }

    /**
     * @param  array<string, mixed>  $evidence
     */
    private function blocking(
        DispatchReadinessBlockerCode $code,
        array $evidence,
        ?int $planVersion,
        int $attemptVersion,
    ): DispatchReadinessBlocker {
        return new DispatchReadinessBlocker(
            $code,
            DispatchReadinessSeverity::Blocking,
            'dispatch.readiness.'.$code->value,
            $evidence,
            $planVersion,
            $attemptVersion,
        );
    }
}
