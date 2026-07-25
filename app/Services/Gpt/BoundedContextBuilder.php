<?php

namespace App\Services\Gpt;

use App\Models\DispatchJob;
use App\Models\OperationalAsset;
use App\Models\User;
use App\Services\DispatchResourceEligibility;

final class BoundedContextBuilder
{
    public function __construct(
        private DispatchResourceEligibility $eligibility
    ) {}

    /**
     * @return array{
     *     context: array<string, mixed>,
     *     context_hash: string,
     *     input_references: array{user_ids: list<int>, asset_ids: list<int>},
     *     prompt_summary: string
     * }
     */
    public function buildForDispatchJob(DispatchJob $job): array
    {
        $job->loadMissing([
            'serviceRequest.client',
            'personnelAssignments.user',
            'assetAssignments.asset',
        ]);

        $candidateUsers = User::query()
            ->where('is_active', true)
            ->whereNull('suspended_at')
            ->with(['roles:id,name', 'personnelProfile', 'personnelCredentials', 'dispatchAssignments.job'])
            ->get();

        $candidateAssets = OperationalAsset::query()
            ->with(['maintenanceWorkOrders', 'assignments.job', 'inspections'])
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
                'name' => $user->name,
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
                'name' => $asset->name,
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
                'client' => $job->client !== '' ? $job->client : ($job->serviceRequest->client->company_name ?? ''),
                'priority' => $job->priority->value,
                'scheduled_start' => $job->scheduled_start?->toIso8601String(),
                'scheduled_end' => $job->scheduled_end?->toIso8601String(),
                'requirements' => $job->requirements ?? [],
                'site_name' => $this->sanitizeText($job->site),
            ],
            'personnel_candidates' => $personnelCandidates,
            'asset_candidates' => $assetCandidates,
        ];

        $jsonContext = json_encode($context, JSON_THROW_ON_ERROR);
        $contextHash = hash('sha256', $jsonContext);

        $promptSummary = sprintf(
            'Dispatch recommendation for job %s (%s, priority: %s, site: %s)',
            $job->reference,
            $job->title,
            $job->priority->value,
            $job->site
        );

        return [
            'context' => $context,
            'context_hash' => $contextHash,
            'input_references' => [
                'user_ids' => array_values(array_unique($userIds)),
                'asset_ids' => array_values(array_unique($assetIds)),
            ],
            'prompt_summary' => $promptSummary,
        ];
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
}
