<?php

namespace Database\Seeders;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Models\ReportExport;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use LogicException;

final class BrowserAcceptanceSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Browser acceptance fixtures may only be seeded in local or testing environments.');
        }

        $this->call(RolePermissionSeeder::class);

        $admin = $this->user('Browser Admin', 'browser.admin@example.com', RoleName::SystemAdministrator);
        $dispatcher = $this->user('Browser Dispatcher', 'browser.dispatcher@example.com', RoleName::Dispatcher);
        $manager = $this->user('Browser Manager', 'browser.manager@example.com', RoleName::OperationsManager);
        $driver = $this->user('Browser Driver', 'browser.driver@example.com', RoleName::Driver);

        $job = DispatchJob::query()->create([
            'reference' => 'R6-BROWSER-001',
            'client' => 'Browser Acceptance Client',
            'title' => 'Deterministic browser acceptance lift',
            'site' => 'Browser fixture site',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Draft,
            'requirements' => [],
            'created_by' => $dispatcher->id,
        ]);
        $assignedJob = DispatchJob::query()->create([
            'reference' => 'R6-BROWSER-002',
            'client' => 'Browser Assigned Client',
            'title' => 'Assigned browser upload lift',
            'site' => 'Assigned fixture site',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Dispatched,
            'requirements' => [],
            'created_by' => $dispatcher->id,
        ]);
        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $assignedJob->id,
            'user_id' => $driver->id,
            'assignment_type' => 'driver',
            'response_status' => AssignmentResponse::Accepted,
            'assigned_by' => $dispatcher->id,
            'active_from' => now()->subMinute(),
        ]);

        $report = JobReport::query()->create([
            'dispatch_job_id' => $job->id,
            'author_id' => $manager->id,
            'started_at' => now()->subHour(),
            'ended_at' => now()->subMinutes(10),
            'work_summary' => 'Browser fixture report for authorized download coverage.',
            'remarks' => 'Deterministic local browser evidence.',
            'status' => JobReportStatus::Submitted,
            'submitted_at' => now()->subMinutes(5),
        ]);

        $attachmentPath = 'attachments/browser/r6-report.txt';
        Storage::disk('local')->put($attachmentPath, 'R6 browser attachment fixture');
        $attachment = $report->attachments()->create([
            'uploaded_by' => $manager->id,
            'kind' => 'document',
            'disk' => 'local',
            'path' => $attachmentPath,
            'original_filename' => 'r6-report.txt',
            'mime_type' => 'text/plain',
            'size_bytes' => Storage::disk('local')->size($attachmentPath),
            'checksum_sha256' => hash_file('sha256', Storage::disk('local')->path($attachmentPath)),
            'retention_until' => now()->addDays(30),
        ]);

        $exportPath = 'exports/browser/r6-report.csv';
        Storage::disk('local')->put($exportPath, "reference,status\nR6-BROWSER-001,draft\n");
        $export = ReportExport::query()->create([
            'id' => '00000000-0000-0000-0000-000000000006',
            'user_id' => $manager->id,
            'export_type' => ReportExportType::JobReports,
            'format' => 'csv',
            'status' => ReportExportStatus::Completed,
            'filters' => ['job_id' => $job->id],
            'file_path' => $exportPath,
            'mime_type' => 'text/csv',
            'file_size_bytes' => Storage::disk('local')->size($exportPath),
            'row_count' => 1,
            'expires_at' => now()->addDay(),
            'download_expires_at' => now()->addDay(),
            'completed_at' => now(),
            'purge_at' => now()->addDays(2),
        ]);
        $pdfPath = 'exports/browser/r6-report.pdf';
        Storage::disk('local')->put($pdfPath, '%PDF-1.4 browser fixture');
        $pdfExport = ReportExport::query()->create([
            'id' => '00000000-0000-0000-0000-000000000007',
            'user_id' => $manager->id,
            'export_type' => ReportExportType::JobReports,
            'format' => 'pdf',
            'status' => ReportExportStatus::Completed,
            'filters' => ['job_id' => $job->id],
            'file_path' => $pdfPath,
            'mime_type' => 'application/pdf',
            'file_size_bytes' => Storage::disk('local')->size($pdfPath),
            'row_count' => 1,
            'expires_at' => now()->addDay(),
            'download_expires_at' => now()->addDay(),
            'completed_at' => now(),
            'purge_at' => now()->addDays(2),
        ]);

        $gptJob = DispatchJob::query()->create([
            'reference' => 'R6-BROWSER-004',
            'client' => 'GPT Recommendations Client',
            'title' => 'AI Assisted browser fixture lift',
            'site' => 'AI fixture site',
            'scheduled_start' => now()->addDays(2),
            'scheduled_end' => now()->addDays(2)->addHours(4),
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Draft,
            'requirements' => [],
            'created_by' => $dispatcher->id,
        ]);

        $recommendations = [
            'pending_accept' => $this->recommendation($gptJob, $dispatcher, GptRecommendationStatus::PendingReview),
            'pending_reject' => $this->recommendation($gptJob, $dispatcher, GptRecommendationStatus::PendingReview),
            'failed' => $this->recommendation($gptJob, $dispatcher, GptRecommendationStatus::Failed, ['error_message' => 'GPT generation failed. Please retry.']),
            'stale' => $this->recommendation($gptJob, $dispatcher, GptRecommendationStatus::Stale),
            'accepted' => $this->recommendation($gptJob, $dispatcher, GptRecommendationStatus::Accepted, ['decided_by' => $manager->id, 'decided_at' => now()->subMinutes(3)]),
            'rejected' => $this->recommendation($gptJob, $dispatcher, GptRecommendationStatus::Rejected, ['decided_by' => $manager->id, 'decided_at' => now()->subMinutes(2)]),
        ];

        $truck = OperationalAsset::query()->firstOrCreate(
            ['code' => 'TRK-01'],
            ['name' => 'Heavy Rig Truck', 'kind' => 'truck', 'status' => AssetStatus::Available]
        );
        $crane = OperationalAsset::query()->firstOrCreate(
            ['code' => 'CRN-01'],
            ['name' => '50T Mobile Crane', 'kind' => 'crane', 'status' => AssetStatus::Available]
        );

        $approvalJob = DispatchJob::query()->create([
            'reference' => 'R6-BROWSER-003',
            'client' => 'Emergency Approval Client',
            'title' => 'Emergency lift requiring manager approval',
            'site' => 'Emergency fixture site',
            'scheduled_start' => now()->addDay(),
            'scheduled_end' => now()->addDay()->addHours(4),
            'priority' => DispatchPriority::Emergency,
            'status' => DispatchStatus::Draft,
            'requirements' => ['Urgent crane lift'],
            'created_by' => $dispatcher->id,
        ]);

        $approvalRequest = ApprovalRequest::query()->create([
            'subject_type' => $approvalJob->getMorphClass(),
            'subject_id' => $approvalJob->id,
            'requested_by' => $dispatcher->id,
            'kind' => 'dispatch_activation',
            'status' => ApprovalStatus::Pending,
            'reason' => 'Emergency priority activation requires manager authorization.',
            'requested_changes' => ['notes' => 'Site crane ready, priority response needed.'],
        ]);

        $lifecycleJob = DispatchJob::query()->create([
            'reference' => 'R6-BROWSER-005',
            'client' => 'Lifecycle Journey Client',
            'title' => 'Lifecycle testing fixture lift',
            'site' => 'Lifecycle fixture site',
            'scheduled_start' => now()->addDays(3),
            'scheduled_end' => now()->addDays(3)->addHours(4),
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Draft,
            'requirements' => [],
            'created_by' => $dispatcher->id,
        ]);

        File::ensureDirectoryExists(storage_path('framework/testing'));
        File::put(storage_path('framework/testing/browser-fixtures.json'), json_encode([
            'users' => [
                'admin' => $admin->username,
                'dispatcher' => $dispatcher->username,
                'manager' => $manager->username,
                'driver' => $driver->username,
            ],
            'password' => 'password',
            'job_id' => $job->id,
            'assigned_job_id' => $assignedJob->id,
            'approval_job_id' => $approvalJob->id,
            'approval_request_id' => $approvalRequest->id,
            'lifecycle_job_id' => $lifecycleJob->id,
            'truck_id' => $truck->id,
            'crane_id' => $crane->id,
            'report_id' => $report->id,
            'attachment_id' => $attachment->id,
            'export_ids' => [$export->id, $pdfExport->id],
            'recommendations' => collect($recommendations)->mapWithKeys(static fn (GptRecommendation $rec, string $key): array => [$key => $rec->id])->all(),
        ], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT));
    }

    private function user(string $name, string $email, RoleName $role): User
    {
        $user = User::query()->create([
            'name' => $name,
            'username' => Username::fromEmail($email),
            'email' => $email,
            'email_verified_at' => now(),
            'password' => Hash::make('password'),
            'is_active' => true,
        ]);
        $user->syncRoles([$role->value]);

        return $user;
    }

    /** @param array<string, mixed> $overrides */
    private function recommendation(DispatchJob $job, User $requester, GptRecommendationStatus $status, array $overrides = []): GptRecommendation
    {
        return GptRecommendation::query()->create(array_merge([
            'subject_type' => $job->getMorphClass(),
            'subject_id' => $job->id,
            'requested_by' => $requester->id,
            'purpose' => 'dispatch_assignment',
            'context_hash' => hash('sha256', 'r6-browser-'.$job->id),
            'input_references' => ['job_reference' => $job->reference],
            'recommendation' => [
                'summary' => 'Use the available qualified crew for this fixture job.',
                'reasons' => ['Qualification and availability were checked.'],
                'assumptions' => ['Fixture availability is current.'],
                'conflicts' => [],
                'proposed_personnel' => [],
                'proposed_assets' => [],
            ],
            'conflicts' => [],
            'model' => 'gpt-5-mini',
            'status' => $status,
            'prompt_summary' => 'Bounded fixture context for browser acceptance.',
            'response_summary' => $status === GptRecommendationStatus::Failed ? null : 'Fixture recommendation summary.',
            'usage' => ['prompt_tokens' => 12, 'completion_tokens' => 8, 'total_tokens' => 20],
            'cost_usd' => 0.0002,
            'generated_at' => now()->subMinute(),
            'latency_ms' => 42,
            'expires_at' => in_array($status, [GptRecommendationStatus::PendingReview, GptRecommendationStatus::Stale], true)
                ? now()->addMinutes(10)
                : null,
            'purge_at' => now()->addDays(30),
        ], $overrides));
    }
}
