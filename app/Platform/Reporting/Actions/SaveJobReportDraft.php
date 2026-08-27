<?php

namespace App\Platform\Reporting\Actions;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class SaveJobReportDraft
{
    public function __construct(
        private readonly UploadAttachmentAction $uploadAttachmentAction
    ) {}

    /**
     * @param  array{dispatch_job_id: int, started_at?: string|null, ended_at?: string|null, ending_meter_value?: float|int|null, meter_type?: string|null, latitude?: float|null, longitude?: float|null, work_summary: string, remarks?: string|null, attachments?: array<int, mixed>}  $data
     */
    public function execute(User $author, array $data, ?JobReport $existingReport = null): JobReport
    {
        return DB::transaction(function () use ($author, $data, $existingReport): JobReport {
            $job = DispatchJob::query()->findOrFail($data['dispatch_job_id']);

            if ($existingReport) {
                $existingReport->update([
                    'started_at' => $data['started_at'] ?? $existingReport->started_at,
                    'ended_at' => $data['ended_at'] ?? $existingReport->ended_at,
                    'ending_meter_value' => $data['ending_meter_value'] ?? $existingReport->ending_meter_value,
                    'meter_type' => $data['meter_type'] ?? $existingReport->meter_type,
                    'latitude' => $data['latitude'] ?? $existingReport->latitude,
                    'longitude' => $data['longitude'] ?? $existingReport->longitude,
                    'work_summary' => $data['work_summary'],
                    'remarks' => $data['remarks'] ?? $existingReport->remarks,
                    'status' => JobReportStatus::Draft,
                ]);
                $report = $existingReport;
            } else {
                $report = JobReport::query()->create([
                    'dispatch_job_id' => $job->id,
                    'author_id' => $author->id,
                    'started_at' => $data['started_at'] ?? null,
                    'ended_at' => $data['ended_at'] ?? null,
                    'ending_meter_value' => $data['ending_meter_value'] ?? null,
                    'meter_type' => $data['meter_type'] ?? null,
                    'latitude' => $data['latitude'] ?? null,
                    'longitude' => $data['longitude'] ?? null,
                    'work_summary' => $data['work_summary'],
                    'remarks' => $data['remarks'] ?? null,
                    'status' => JobReportStatus::Draft,
                    'submitted_at' => null,
                ]);
            }

            if (! empty($data['attachments'])) {
                foreach ($data['attachments'] as $file) {
                    if ($file instanceof UploadedFile) {
                        $this->uploadAttachmentAction->execute($author, $report, $file, 'report_attachment');
                    }
                }
            }

            AuditEvent::query()->create([
                'actor_id' => $author->id,
                'subject_type' => $report->getMorphClass(),
                'subject_id' => $report->id,
                'action' => 'job_report.draft_saved',
                'after_state' => [
                    'dispatch_job_id' => $job->id,
                    'status' => JobReportStatus::Draft->value,
                ],
                'request_id' => request()->header('X-Request-ID') ?? request()->ip(),
                'ip_address' => request()->ip(),
                'occurred_at' => now(),
            ]);

            return $report;
        });
    }
}
