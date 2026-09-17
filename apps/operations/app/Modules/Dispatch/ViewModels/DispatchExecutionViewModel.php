<?php

namespace App\Modules\Dispatch\ViewModels;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Rental\Models\RentalHandoverEvidence;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesDeliveryEvidence;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

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
        $delays = self::delays($job, $user);
        $location = self::latestLocation($job, $user);

        return [
            'status' => [
                'value' => $job->status->value,
                'label' => $job->status->label(),
            ],
            'updated_at' => $job->updated_at?->toIso8601String(),
            'milestones' => $milestones,
            'issues' => self::issues($reports, $delays),
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
            'delays' => $delays,
            'handoff_evidence' => self::handoffEvidence($job, $user),
            'activity' => self::activity($milestones, $reports, $location, $delays),
        ];
    }

    public static function appliesTo(DispatchJob $job): bool
    {
        return in_array($job->status, self::ACTIVE_STATUSES, true)
            || $job->status === DispatchStatus::Completed;
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
     * @param  list<array<string, mixed>>  $delays
     * @return list<array{kind: string, title: string, detail: string}>
     */
    private static function issues(array $reports, array $delays = []): array
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

        foreach ($delays as $delay) {
            $reason = $delay['reason_label'] ?? $delay['reason'] ?? 'Delay';
            $issues[] = [
                'kind' => 'delay',
                'title' => 'Delay reported: '.$reason,
                'detail' => trim((string) ($delay['notes'] ?? '')) ?: ($delay['estimated_minutes'] ? "Estimated impact: {$delay['estimated_minutes']}m" : 'Field operator reported a delay.'),
                'reported_at' => $delay['reported_at'],
            ];
        }

        return $issues;
    }

    /** @return list<array<string, mixed>> */
    private static function delays(DispatchJob $job, User $user): array
    {
        /** @var list<array<string, mixed>> $delays */
        $delays = [];
        $records = $job->delays()
            ->with(['reporter:id,name', 'operationalAsset:id,code,name'])
            ->latest('reported_at')
            ->limit(20)
            ->get();

        foreach ($records as $delay) {
            $delays[] = [
                'id' => (int) $delay->getKey(),
                'context' => [
                    'value' => $delay->context->value,
                    'label' => $delay->context->label(),
                ],
                'reason' => $delay->reason->value,
                'reason_label' => $delay->reason_label ?? $delay->reason->label(),
                'estimated_minutes' => $delay->estimated_minutes,
                'notes' => $delay->notes,
                'reported_at' => $delay->reported_at->toIso8601String(),
                'created_at' => $delay->created_at->toIso8601String(),
                'operational_asset_id' => $delay->operational_asset_id,
                'reporter' => $delay->reporter === null ? null : [
                    'id' => (int) $delay->reporter->id,
                    'name' => $delay->reporter->name,
                ],
                'asset' => $delay->operationalAsset === null ? null : [
                    'id' => (int) $delay->operationalAsset->id,
                    'code' => $delay->operationalAsset->code,
                    'name' => $delay->operationalAsset->name,
                ],
            ];
        }

        return $delays;
    }

    /** @param list<array<string, mixed>> $milestones
     * @param  list<array<string, mixed>>  $reports
     * @param  array<string, mixed>|null  $location
     * @param  list<array<string, mixed>>  $delays
     * @return list<array<string, mixed>>
     */
    private static function activity(array $milestones, array $reports, ?array $location, array $delays = []): array
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

        foreach ($delays as $delay) {
            $activity[] = [
                'id' => 'delay-'.$delay['id'],
                'kind' => 'delay',
                'title' => 'Delay reported: '.$delay['reason_label'],
                'detail' => trim((string) ($delay['notes'] ?? '')) ?: ($delay['estimated_minutes'] ? "Estimated delay: {$delay['estimated_minutes']} min" : 'Operational delay reported by field operator.'),
                'recorded_at' => $delay['reported_at'],
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

    /** @return array<string, mixed>|null */
    private static function handoffEvidence(DispatchJob $job, User $user): ?array
    {
        $sourceType = $job->sourceType();
        $source = $job->relationLoaded('source') ? $job->getRelationValue('source') : null;

        if ($source === null) {
            $handoff = $job->canonicalHandoff;
            $type = $sourceType !== null ? $sourceType->value : ($job->source_type ?? ($handoff !== null ? $handoff->source_type : null));
            $sourceId = $job->source_id ?? ($handoff !== null ? $handoff->source_id : null) ?? $job->service_request_id;
            if ($type === 'rental_reservation') {
                $source = RentalReservation::query()->find($sourceId);
            } elseif ($type === 'sales_order') {
                $source = SalesOrder::query()->find($sourceId);
            }
        }

        if ($source === null) {
            $rentalEvidence = RentalHandoverEvidence::query()->where('dispatch_job_id', $job->id)->latest('submitted_at')->first();
            if ($rentalEvidence !== null) {
                $source = $rentalEvidence->reservation;
            } else {
                $salesEvidence = SalesDeliveryEvidence::query()->where('dispatch_job_id', $job->id)->latest('submitted_at')->first();
                if ($salesEvidence !== null) {
                    $source = $salesEvidence->order;
                }
            }
        }

        $firstAsset = $job->assetAssignments->first();
        $assetContext = $firstAsset !== null ? [
            'code' => $firstAsset->asset_code ?? 'Assigned Unit',
            'name' => $firstAsset->asset_name ?? 'Heavy Equipment Unit',
        ] : null;

        $mapPhotos = static function (?array $photos): array {
            $diskName = config('filesystems.default', 'public');

            return array_values(array_map(function ($photo) use ($diskName) {
                if (is_string($photo)) {
                    return [
                        'path' => $photo,
                        'url' => Storage::disk($diskName)->url($photo),
                        'label' => 'Evidence Photo',
                    ];
                }

                $path = $photo['file_path'] ?? $photo['path'] ?? null;
                $disk = $photo['storage_disk'] ?? $photo['disk'] ?? $diskName;
                $url = $photo['url'] ?? ($path ? Storage::disk($disk)->url($path) : null);

                return [
                    'path' => $path ?? '',
                    'url' => $url,
                    'label' => $photo['label'] ?? 'Evidence Photo',
                ];
            }, $photos ?? []));
        };

        // Check if rental reservation
        if ($source instanceof RentalReservation) {
            $latest = $source->latestHandoverEvidence;
            if ($latest === null) {
                $latest = RentalHandoverEvidence::query()
                    ->where('rental_reservation_id', $source->id)
                    ->orWhere('dispatch_job_id', $job->id)
                    ->latest('submitted_at')
                    ->first();
            }

            if ($latest !== null) {
                $status = $source->status;

                return [
                    'type' => 'rental',
                    'source_id' => (int) $source->id,
                    'source_reference' => $source->reference,
                    'handover_type' => $latest->handover_type,
                    'submitted_at' => $latest->submitted_at?->toIso8601String(),
                    'received_at' => $latest->created_at?->toIso8601String(),
                    'submitted_by' => $latest->submitter ? [
                        'id' => (int) $latest->submitter->id,
                        'name' => $latest->submitter->name,
                    ] : null,
                    'signee_name' => $latest->signee_name,
                    'signee_role' => $latest->signee_role,
                    'hour_meter' => (float) $latest->hour_meter,
                    'fuel_percent' => (int) $latest->fuel_percent,
                    'condition_assessment' => $latest->condition_assessment,
                    'condition_notes' => $latest->condition_notes,
                    'damage_noted' => (bool) $latest->damage_noted,
                    'damage_notes' => $latest->damage_notes,
                    'photos' => $mapPhotos($latest->photos),
                    'signature_path' => $latest->signature_path,
                    'signature_url' => $latest->signature_url,
                    'managerial_status' => $status->value,
                    'managerial_status_label' => str($status->value)->replace('_', ' ')->title()->toString(),
                    'can_checkout' => $user->can(PermissionName::RentalCheckout->value) && $status->canCheckout(),
                    'can_return' => $user->can(PermissionName::RentalReturn->value) && $status->canReturn(),
                    'asset' => $assetContext,
                ];
            }
        }

        // Check if sales order
        if ($source instanceof SalesOrder) {
            $latest = $source->latestDeliveryEvidence;
            if ($latest === null) {
                $latest = SalesDeliveryEvidence::query()
                    ->where('sales_order_id', $source->id)
                    ->orWhere('dispatch_job_id', $job->id)
                    ->latest('submitted_at')
                    ->first();
            }

            if ($latest !== null) {
                $status = $source->status;

                return [
                    'type' => 'sales',
                    'source_id' => (int) $source->id,
                    'source_reference' => $source->reference,
                    'submitted_at' => $latest->submitted_at?->toIso8601String(),
                    'received_at' => $latest->created_at?->toIso8601String(),
                    'submitted_by' => $latest->submitter ? [
                        'id' => (int) $latest->submitter->id,
                        'name' => $latest->submitter->name,
                    ] : null,
                    'signee_name' => $latest->signee_name,
                    'signee_role' => $latest->signee_role,
                    'verified_vin' => $latest->verified_vin,
                    'accessories_checked' => $latest->accessories_checked ?? [],
                    'delivery_notes' => $latest->delivery_notes,
                    'photos' => $mapPhotos($latest->photos),
                    'signature_path' => $latest->signature_path,
                    'signature_url' => $latest->signature_url,
                    'managerial_status' => $status->value,
                    'managerial_status_label' => str($status->value)->replace('_', ' ')->title()->toString(),
                    'can_fulfill' => $user->can(PermissionName::SalesFulfill->value) && $status === SalesOrderStatus::Confirmed,
                    'asset' => $assetContext,
                ];
            }
        }

        return null;
    }
}
