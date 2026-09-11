<?php

namespace App\Platform\Reporting\Actions;

use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\DispatchCompletionNotification;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ResubmitJobReport
{
    public function __construct(
        private readonly UploadAttachmentAction $uploadAttachmentAction
    ) {}

    /**
     * @param  array{started_at?: string|null, ended_at?: string|null, ending_meter_value?: float|int|null, meter_type?: string|null, latitude?: float|null, longitude?: float|null, work_summary: string, remarks?: string|null, attachments?: array<int, mixed>}  $data
     */
    public function execute(User $author, JobReport $report, array $data): JobReport
    {
        Gate::forUser($author)->authorize('resubmit', $report);

        if (! $report->canBeResubmitted()) {
            throw ValidationException::withMessages([
                'status' => 'Only rejected or draft job reports can be resubmitted.',
            ]);
        }

        return DB::transaction(function () use ($author, $report, $data): JobReport {
            $beforeState = [
                'status' => $report->status->value,
                'work_summary' => $report->work_summary,
                'resubmitted_count' => $report->resubmitted_count,
            ];

            $report->update([
                'started_at' => $data['started_at'] ?? $report->started_at,
                'ended_at' => $data['ended_at'] ?? $report->ended_at,
                'ending_meter_value' => $data['ending_meter_value'] ?? $report->ending_meter_value,
                'meter_type' => $data['meter_type'] ?? $report->meter_type,
                'latitude' => $data['latitude'] ?? $report->latitude,
                'longitude' => $data['longitude'] ?? $report->longitude,
                'work_summary' => $data['work_summary'],
                'remarks' => $data['remarks'] ?? $report->remarks,
                'status' => JobReportStatus::Submitted,
                'resubmitted_count' => $report->resubmitted_count + 1,
                'submitted_at' => now(),
            ]);

            if (! empty($data['attachments'])) {
                foreach ($data['attachments'] as $file) {
                    if ($file instanceof UploadedFile) {
                        $this->uploadAttachmentAction->execute($author, $report, $file, 'report_attachment');
                    }
                }
            }

            if (! empty($data['ending_meter_value'])) {
                foreach ($report->job->assetAssignments()->whereNull('active_until')->with('asset')->get() as $assignment) {
                    $asset = $assignment->asset;
                    if ($asset->meter_value === null || (float) $data['ending_meter_value'] > (float) $asset->meter_value) {
                        $asset->update([
                            'meter_value' => $data['ending_meter_value'],
                        ]);
                        AuditEvent::query()->create([
                            'actor_id' => $author->id,
                            'subject_type' => $asset->getMorphClass(),
                            'subject_id' => $asset->id,
                            'action' => 'asset.meter_updated_from_report',
                            'after_state' => [
                                'meter_value' => (float) $data['ending_meter_value'],
                                'job_report_id' => $report->id,
                            ],
                            'request_id' => request()->header('X-Request-ID') ?? request()->ip(),
                            'ip_address' => request()->ip(),
                            'occurred_at' => now(),
                        ]);
                    }
                }
            }

            AuditEvent::query()->create([
                'actor_id' => $author->id,
                'subject_type' => $report->getMorphClass(),
                'subject_id' => $report->id,
                'action' => 'job_report.resubmitted',
                'before_state' => $beforeState,
                'after_state' => [
                    'dispatch_job_id' => $report->dispatch_job_id,
                    'status' => JobReportStatus::Submitted->value,
                    'resubmitted_count' => $report->resubmitted_count,
                    'submitted_at' => $report->submitted_at?->toIso8601String(),
                ],
                'request_id' => request()->header('X-Request-ID') ?? request()->ip(),
                'ip_address' => request()->ip(),
                'occurred_at' => now(),
            ]);

            // Notify operations managers of resubmission
            $recipients = User::query()
                ->where('is_active', true)
                ->role(RoleName::OperationsManager->value)
                ->get();

            foreach ($recipients as $recipient) {
                SendQueuedNotificationJob::dispatch(
                    $recipient,
                    new DispatchCompletionNotification($report->job, $report)
                );
            }

            return $report;
        });
    }
}
