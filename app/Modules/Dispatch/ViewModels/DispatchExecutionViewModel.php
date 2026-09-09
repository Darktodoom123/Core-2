<?php

namespace App\Modules\Dispatch\ViewModels;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

final class DispatchExecutionViewModel
{
    /** @var list<DispatchStatus> */
    private const ACTIVE_STATUSES = [
        DispatchStatus::Dispatched,
        DispatchStatus::Accepted,
        DispatchStatus::EnRoute,
        DispatchStatus::Arrived,
        DispatchStatus::Working,
    ];

    /** @return array<string, mixed> */
    public static function make(DispatchJob $job, User $user): array
    {
        $reopenedAt = AuditEvent::query()
            ->where('subject_type', $job->getMorphClass())
            ->where('subject_id', $job->getKey())
            ->where('action', 'dispatch.reopened')
            ->latest('occurred_at')
            ->value('occurred_at');

        $statusEvents = AuditEvent::query()
            ->where('subject_type', $job->getMorphClass())
            ->where('subject_id', $job->getKey())
            ->whereIn('action', ['dispatch.status_updated', 'dispatch.activated'])
            ->when($reopenedAt !== null, fn ($query) => $query->where('occurred_at', '>=', $reopenedAt))
            ->latest('occurred_at')
            ->limit(25)
            ->get(['id', 'after', 'occurred_at']);

        $milestones = self::milestones($statusEvents);
        $reports = self::reports($job, $user);
        $location = self::latestLocation($job, $user);

        return [
            'status' => [
                'value' => $job->status->value,
                'label' => $job->status->label(),
            ],
            'updated_at' => $job->updated_at?->toIso8601String(),
            'milestones' => $milestones,
            'issues' => self::issues($reports),
            'site' => [
                'name' => $job->site,
                'notes' => $job->site_notes,
                'planned_coordinates' => $job->site_latitude === null || $job->site_longitude === null ? null : [
                    'latitude' => (float) $job->site_latitude,
                    'longitude' => (float) $job->site_longitude,
                ],
                'latest_location' => $location,
            ],
            'reports' => $reports,
            'activity' => self::activity($milestones, $reports, $location),
        ];
    }

    public static function appliesTo(DispatchJob $job): bool
    {
        return in_array($job->status, self::ACTIVE_STATUSES, true);
    }

    /** @param Collection<int, AuditEvent> $events
     * @return list<array{id: int, status: array{value: string, label: string}, recorded_at: string|null}>
     */
    private static function milestones(Collection $events): array
    {
        /** @var list<array{id: int, status: array{value: string, label: string}, recorded_at: string|null}> $milestones */
        $milestones = [];

        foreach ($events->reverse() as $event) {
            $after = $event->getAttribute('after');
            if (is_string($after)) {
                $after = json_decode($after, true);
            }
            if (! is_array($after)) {
                continue;
            }

            $value = $after['status'] ?? null;
            $status = $value instanceof \BackedEnum
                ? DispatchStatus::tryFrom((string) $value->value)
                : DispatchStatus::tryFrom((string) $value);

            if ($status === null || ! self::isActiveOrCompleted($status)) {
                continue;
            }

            $milestones[] = [
                'id' => (int) $event->getKey(),
                'status' => [
                    'value' => $status->value,
                    'label' => $status->label(),
                ],
                'recorded_at' => $event->occurred_at?->toIso8601String(),
            ];
        }

        return $milestones;
    }

    private static function isActiveOrCompleted(DispatchStatus $status): bool
    {
        return in_array($status, [...self::ACTIVE_STATUSES, DispatchStatus::Completed], true);
    }

    /** @return list<array<string, mixed>> */
    private static function reports(DispatchJob $job, User $user): array
    {
        if (! Gate::forUser($user)->allows('viewAny', JobReport::class)) {
            return [];
        }

        /** @var list<array<string, mixed>> $reports */
        $reports = [];
        $records = JobReport::query()
            ->visibleTo($user)
            ->where('dispatch_job_id', $job->getKey())
            ->whereIn('status', [
                JobReportStatus::Submitted->value,
                JobReportStatus::Approved->value,
                JobReportStatus::Rejected->value,
            ])
            ->latest('submitted_at')
            ->latest('created_at')
            ->limit(10)
            ->get(['id', 'status', 'started_at', 'ended_at', 'submitted_at', 'work_summary', 'remarks', 'latitude', 'longitude']);

        foreach ($records as $report) {
            $reports[] = [
                'id' => (int) $report->getKey(),
                'status' => [
                    'value' => $report->status->value,
                    'label' => $report->status->label(),
                ],
                'started_at' => $report->started_at?->toIso8601String(),
                'ended_at' => $report->ended_at?->toIso8601String(),
                'submitted_at' => $report->submitted_at?->toIso8601String(),
                'work_summary' => $report->work_summary,
                'remarks' => $report->remarks,
                'coordinates' => $report->latitude === null || $report->longitude === null ? null : [
                    'latitude' => (float) $report->latitude,
                    'longitude' => (float) $report->longitude,
                ],
            ];
        }

        return $reports;
    }

    /** @return array<string, mixed>|null */
    private static function latestLocation(DispatchJob $job, User $user): ?array
    {
        /** @var TrackingClientInterface $trackingClient */
        $trackingClient = app(TrackingClientInterface::class);
        $latest = $trackingClient->getLatestLocationForJob($job->id, $user);

        if ($latest === null || ! $latest->sharingEnabled || $latest->latitude === null || $latest->longitude === null) {
            return null;
        }

        $assignedUser = User::query()->find($latest->userId, ['id', 'name']);
        $asset = $latest->operationalAssetId !== null
            ? OperationalAsset::withTrashed()->find($latest->operationalAssetId, ['id', 'code', 'name'])
            : null;

        return [
            'id' => $latest->id,
            'latitude' => $latest->latitude,
            'longitude' => $latest->longitude,
            'accuracy_metres' => $latest->accuracyMetres,
            'source' => $latest->source,
            'user' => $assignedUser === null ? null : [
                'id' => (int) $assignedUser->id,
                'name' => $assignedUser->name,
            ],
            'asset' => $asset === null ? null : [
                'id' => (int) $asset->id,
                'code' => $asset->code,
                'name' => $asset->name,
            ],
            'captured_at' => $latest->capturedAt?->toIso8601String(),
            'received_at' => $latest->receivedAt?->toIso8601String(),
        ];
    }

    /** @param list<array<string, mixed>> $reports
     * @return list<array{kind: string, title: string, detail: string}>
     */
    private static function issues(array $reports): array
    {
        /** @var list<array{kind: string, title: string, detail: string}> $issues */
        $issues = [];

        foreach ($reports as $report) {
            if (($report['status']['value'] ?? null) !== JobReportStatus::Rejected->value) {
                continue;
            }

            $issues[] = [
                'kind' => 'report',
                'title' => 'Field report needs attention',
                'detail' => 'A submitted field report was rejected and needs follow-up in the reports workspace.',
            ];
        }

        return $issues;
    }

    /** @param list<array<string, mixed>> $milestones
     * @param  list<array<string, mixed>>  $reports
     * @param  array<string, mixed>|null  $location
     * @return list<array<string, mixed>>
     */
    private static function activity(array $milestones, array $reports, ?array $location): array
    {
        /** @var list<array<string, mixed>> $activity */
        $activity = [];

        foreach ($milestones as $milestone) {
            $activity[] = [
                'id' => 'status-'.$milestone['id'],
                'kind' => 'status',
                'title' => 'Status recorded: '.$milestone['status']['label'],
                'detail' => 'Field status update recorded for this dispatch.',
                'recorded_at' => $milestone['recorded_at'],
            ];
        }

        foreach ($reports as $report) {
            $activity[] = [
                'id' => 'report-'.$report['id'],
                'kind' => 'report',
                'title' => 'Field report '.$report['status']['label'],
                'detail' => trim((string) ($report['work_summary'] ?? '')) ?: 'A field report was recorded for this dispatch.',
                'recorded_at' => $report['submitted_at'] ?? $report['ended_at'] ?? $report['started_at'],
            ];
        }

        if ($location !== null) {
            $activity[] = [
                'id' => 'location-'.$location['id'],
                'kind' => 'location',
                'title' => 'Shared location received',
                'detail' => 'A location update is available for this dispatch.',
                'recorded_at' => $location['received_at'] ?? $location['captured_at'],
            ];
        }

        return array_values(collect($activity)
            ->sortByDesc(static fn (array $item): string => (string) ($item['recorded_at'] ?? ''))
            ->take(20)
            ->values()
            ->all());
    }
}
