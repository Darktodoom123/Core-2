<?php

namespace App\Platform\Gpt\Services;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;

final class BoundedContextBuilder
{
    public function __construct(
        private DispatchResourceEligibility $eligibility
    ) {}

    /**
     * @return array{
     *     context: array<string, mixed>,
     *     context_hash: string,
     *     automation_hash: string,
     *     input_references: array{user_ids: list<int>, asset_ids: list<int>},
     *     prompt_summary: string
     * }
     */
    public function buildForDispatchJob(DispatchJob $job): array
    {
        // Context hashes must represent the persisted dispatch state. Database
        // defaults (such as version) are not present on an in-memory model
        // immediately after create(), which would otherwise make a valid
        // recommendation appear stale during locked acceptance.
        $job = $job->fresh() ?? $job;

        $job->loadMissing([
            'serviceRequest.client',
            'personnelAssignments.user',
            'assetAssignments.asset',
        ]);

        $candidateUsers = User::query()
            ->where('is_active', true)
            ->whereNull('suspended_at')
            ->with(['roles:id,name', 'personnelProfile', 'personnelCredentials', 'dispatchAssignments.job'])
            ->orderBy('id')
            ->get();

        $candidateAssets = OperationalAsset::query()
            ->with(['maintenanceWorkOrders', 'inspections'])
            ->orderBy('id')
            ->get();

        $personnelCandidates = [];
        $userIds = [];

        foreach ($candidateUsers as $user) {
            $assignmentType = $this->eligibility->personnelAssignmentType($user);
            if ($assignmentType === null) {
                continue;
            }

            $assessment = $this->eligibility->personnel($user, $assignmentType, $job);
            $userIds[] = (int) $user->id;
            $personnelCandidates[] = [
                'user_id' => (int) $user->id,
                'name' => $this->sanitizeText($user->name),
                'role' => $user->operationalRole()?->value,
                'assignment_type' => $assignmentType,
                'eligible' => $assessment['eligible'],
                'reasons' => $assessment['reasons'],
                'availability' => $assessment['availability']['value'],
            ];
        }

        $assetCandidates = [];
        $assetIds = [];

        foreach ($candidateAssets as $asset) {
            $assessment = $this->eligibility->asset($asset, $asset->kind, $job);
            $assetIds[] = (int) $asset->id;
            $assetCandidates[] = [
                'asset_id' => (int) $asset->id,
                'code' => $asset->code,
                'name' => $this->sanitizeText($asset->name),
                'kind' => $asset->kind,
                'rated_capacity' => $asset->rated_capacity,
                'capacity_unit' => $asset->capacity_unit,
                'eligible' => $assessment['eligible'],
                'reasons' => $assessment['reasons'],
                'readiness' => $assessment['readiness']['value'],
            ];
        }

        $context = [
            'job' => [
                'id' => (int) $job->id,
                'reference' => $job->reference,
                'title' => $this->sanitizeText($job->title),
                'client' => $this->sanitizeText($job->client !== '' ? $job->client : ($job->serviceRequest->client->company_name ?? '')),
                'priority' => $job->priority->value,
                'version' => $job->version,
                'scheduled_start' => $job->scheduled_start?->toIso8601String(),
                'scheduled_end' => $job->scheduled_end?->toIso8601String(),
                'requirements' => $this->sanitizeValue($job->requirements ?? []),
                'site_name' => $this->sanitizeText($job->site),
                'assigned_personnel' => $job->personnelAssignments()->open()->orderBy('id')->get(['user_id', 'assignment_type', 'response_status'])->toArray(),
                'assigned_assets' => $job->assetAssignments()->open()->orderBy('id')->get(['operational_asset_id', 'assignment_type'])->toArray(),
            ],
            'personnel_candidates' => $personnelCandidates,
            'asset_candidates' => $assetCandidates,
        ];

        $plan = $job->currentAttempt?->planVersions()->latest('version')->first();
        if ($plan !== null) {
            $context['plan_requirements'] = $this->sanitizeValue([
                'mandatory_assignments' => $plan->snapshot['mandatory_assignments'] ?? [],
                'assets' => $plan->snapshot['assets'] ?? [],
                'slots' => $plan->requirementSlots()->orderBy('id')->get(['slot_key', 'kind', 'assignment_type', 'is_mandatory', 'user_id', 'operational_asset_id'])->toArray(),
                'offers' => $plan->assignmentOffers()->orderBy('id')->get(['user_id', 'assignment_type', 'is_mandatory', 'status'])->toArray(),
            ]);
        }

        // Relationship and JSON-cast maps do not promise key order. Hash a
        // canonical form so unchanged context is not mistaken for stale data.
        $jsonContext = json_encode($this->canonicalize($context), JSON_THROW_ON_ERROR);
        $contextHash = hash('sha256', $jsonContext);

        $promptSummary = sprintf(
            'Dispatch recommendation requested (priority: %s).',
            $job->priority->value,
        );

        return [
            'context' => $context,
            'context_hash' => $contextHash,
            'automation_hash' => $this->automationHash($context),
            'input_references' => [
                'user_ids' => array_values(array_unique($userIds)),
                'asset_ids' => array_values(array_unique($assetIds)),
            ],
            'prompt_summary' => $promptSummary,
        ];
    }

    /** @param array<string, mixed> $context */
    private function automationHash(array $context): string
    {
        // Display labels and optimistic versions do not change resource needs.
        // The strict full-context hash above still protects human acceptance.
        unset($context['job']['version'], $context['job']['reference'], $context['job']['title'], $context['job']['client']);
        foreach ($context['personnel_candidates'] as &$candidate) {
            unset($candidate['name']);
        }
        unset($candidate);
        foreach ($context['asset_candidates'] as &$candidate) {
            unset($candidate['name'], $candidate['code']);
        }

        return hash('sha256', json_encode($this->canonicalize($context), JSON_THROW_ON_ERROR));
    }

    private function sanitizeText(?string $text): string
    {
        if ($text === null || $text === '') {
            return '';
        }

        // Redact potential emails, phone numbers, secret patterns, and coordinates
        $text = (string) preg_replace('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', '[REDACTED_EMAIL]', $text);
        $text = (string) preg_replace('/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/', '[REDACTED_PHONE]', $text);
        $text = (string) preg_replace('/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/', '[REDACTED_GPS]', $text);

        return trim($text);
    }

    private function sanitizeValue(mixed $value): mixed
    {
        if (is_string($value)) {
            return $this->sanitizeText($value);
        }

        if (is_array($value)) {
            return array_map(fn (mixed $item): mixed => $this->sanitizeValue($item), $value);
        }

        return $value;
    }

    private function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $normalized = array_map(fn (mixed $item): mixed => $this->canonicalize($item), $value);
        if (! array_is_list($normalized)) {
            ksort($normalized);
        }

        return $normalized;
    }
}
