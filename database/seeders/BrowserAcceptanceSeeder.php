<?php

namespace Database\Seeders;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Support\Username;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Models\ReportExport;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Models\SosIncidentRecipient;
use App\Platform\Safety\Models\ToolboxMeeting;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
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
        $manager = $this->user('Browser Manager', 'browser.manager@example.com', RoleName::OperationsManager);
        $operator = $this->user('Browser Crane Operator', 'browser.operator@example.com', RoleName::CraneOperator);
        $safetyOfficer = $this->user('Browser Safety Officer', 'browser.safety@example.com', RoleName::SafetyOfficer);
        $foreman = $this->user('Browser Field Foreman', 'browser.foreman@example.com', RoleName::FieldForeman);

        PersonnelCredential::query()->create([
            'user_id' => $safetyOfficer->id,
            'kind' => 'qualification',
            'credential_number' => 'DOLE-BWC-SO3-BROWSER',
            'credential_type' => 'DOLE-BWC Certified Safety Officer 3',
            'status' => 'active',
            'issued_at' => now()->subYear(),
            'expires_at' => now()->addYears(2),
        ]);

        PersonnelCredential::query()->create([
            'user_id' => $foreman->id,
            'kind' => 'operator_certification',
            'credential_number' => 'TESDA-RIG-BROWSER',
            'credential_type' => 'TESDA NC-II Master Rigger',
            'status' => 'active',
            'issued_at' => now()->subMonths(6),
            'expires_at' => now()->addYears(2),
        ]);

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
            'created_by' => $manager->id,
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
            'created_by' => $manager->id,
        ]);
        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $assignedJob->id,
            'user_id' => $operator->id,
            'assignment_type' => 'operator',
            'response_status' => AssignmentResponse::Accepted,
            'assigned_by' => $manager->id,
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
            'created_by' => $manager->id,
        ]);

        $recommendations = [
            'pending_accept' => $this->recommendation($gptJob, $manager, GptRecommendationStatus::PendingReview),
            'pending_reject' => $this->recommendation($gptJob, $manager, GptRecommendationStatus::PendingReview),
            'failed' => $this->recommendation($gptJob, $manager, GptRecommendationStatus::Failed, ['error_message' => 'GPT generation failed. Please retry.']),
            'stale' => $this->recommendation($gptJob, $manager, GptRecommendationStatus::Stale),
            'accepted' => $this->recommendation($gptJob, $manager, GptRecommendationStatus::Accepted, ['decided_by' => $manager->id, 'decided_at' => now()->subMinutes(3)]),
            'rejected' => $this->recommendation($gptJob, $manager, GptRecommendationStatus::Rejected, ['decided_by' => $manager->id, 'decided_at' => now()->subMinutes(2)]),
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
            'created_by' => $manager->id,
        ]);

        $approvalRequest = ApprovalRequest::query()->create([
            'subject_type' => $approvalJob->getMorphClass(),
            'subject_id' => $approvalJob->id,
            'requested_by' => $manager->id,
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
            'created_by' => $manager->id,
        ]);

        AuditEvent::query()->create([
            'actor_id' => $admin->id,
            'action' => 'user.login',
            'subject_type' => $admin->getMorphClass(),
            'subject_id' => $admin->id,
            'reason' => 'Administrative sign-in for compliance review.',
            'ip_address' => '127.0.0.1',
            'request_id' => 'req-browser-auth-001',
            'occurred_at' => now()->subHours(2),
        ]);

        AuditEvent::query()->create([
            'actor_id' => $manager->id,
            'action' => 'dispatch.created',
            'subject_type' => $job->getMorphClass(),
            'subject_id' => $job->id,
            'reason' => 'Deterministic browser acceptance dispatch creation.',
            'ip_address' => '127.0.0.1',
            'request_id' => 'req-browser-dispatch-002',
            'occurred_at' => now()->subHour(),
        ]);

        AuditEvent::query()->create([
            'actor_id' => $admin->id,
            'action' => 'security.override',
            'subject_type' => $approvalJob->getMorphClass(),
            'subject_id' => $approvalJob->id,
            'reason' => 'Administrative safety override compliance verification.',
            'ip_address' => '127.0.0.1',
            'request_id' => 'req-browser-audit-003',
            'occurred_at' => now()->subMinutes(15),
        ]);

        $sosIncident = SosIncident::query()->create([
            'id' => (string) Str::uuid(),
            'command_id' => 'cmd-browser-sos-001',
            'reporter_id' => $operator->id,
            'dispatch_job_id' => $assignedJob->id,
            'operational_asset_id' => $crane->id,
            'category' => SosIncidentCategory::CriticalAssetMalfunction,
            'status' => SosIncidentStatus::Active,
            'worker_note' => 'Hydraulic boom sensor warning during crane setup.',
            'device_activated_at' => now()->subMinute(),
            'received_at' => now()->subMinute(),
            'escalation_due_at' => now()->addMinutes(2),
            'latitude' => 1.3521,
            'longitude' => 103.8198,
            'accuracy_metres' => 5.0,
            'location_captured_at' => now()->subMinute(),
            'version' => 1,
        ]);

        SosIncidentRecipient::query()->create([
            'sos_incident_id' => $sosIncident->id,
            'user_id' => $manager->id,
            'role_at_alert' => 'operations_manager',
            'resolution_reason' => 'assignment_manager',
            'notified_at' => now()->subMinute(),
        ]);

        $tbm = ToolboxMeeting::query()->create([
            'project_site' => 'Browser fixture site',
            'topic_id' => 'tbm-01',
            'topic_title' => 'DOLE D.O. 13: Critical Lifting & Swing Radius Clearance',
            'topic_category' => 'lifting_rigging',
            'conductor_id' => $foreman->id,
            'conductor_role' => 'Field Foreman',
            'attendee_ids' => ['w1', 'w2', 'w3', 'w4'],
            'attendee_count' => 4,
            'photo_evidence_url' => 'https://storage.example.com/tbm/site-fixture.jpg',
            'photo_timestamp' => now()->subHours(2),
            'notes' => 'Pre-shift briefing on outriggers, swing radius, and rigging inspection.',
            'audit_hash' => 'PH-DOLE-CSHP-BROWSER-TBM-001',
            'safety_officer_id' => null,
            'safety_officer_signed_at' => null,
        ]);

        $liftPlan = CriticalLiftPlan::query()->create([
            'lift_reference' => 'CR-LIFT-BROWSER-001',
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $crane->id,
            'project_site' => 'Browser fixture site',
            'foreman_id' => $foreman->id,
            'rigger_tesda_nc_number' => 'TESDA-RIG-BROWSER',
            'risk_level' => 'critical',
            'gross_load_weight_tons' => 28.50,
            'crane_rated_capacity_tons' => 34.00,
            'load_percentage_of_capacity' => 83.82,
            'boom_length_meters' => 38.00,
            'working_radius_meters' => 14.50,
            'ground_bearing_condition' => 'Engineered Timber Pads',
            'weather_wind_speed_kph' => 12.00,
            'status' => 'pending_so_review',
        ]);

        $hazardTicket = SiteHazardTicket::query()->create([
            'ticket_code' => 'HAZ-BROWSER-001',
            'project_site' => 'Browser fixture site',
            'reporter_id' => $safetyOfficer->id,
            'category' => 'rigging_tackle',
            'severity' => 'moderate',
            'description' => 'Damaged synthetic web sling observed at staging point.',
            'location_detail' => 'Staging Yard Bay 1',
            'corrective_action_required' => 'Tag out immediately.',
            'status' => 'open',
            'work_stoppage_issued' => false,
        ]);

        File::ensureDirectoryExists(storage_path('framework/testing'));
        File::put(storage_path('framework/testing/browser-fixtures.json'), json_encode([
            'users' => [
                'admin' => $admin->username,
                'manager' => $manager->username,
                'operator' => $operator->username,
                'dispatcher' => $manager->username,
                'driver' => $operator->username,
                'safety_officer' => $safetyOfficer->username,
                'foreman' => $foreman->username,
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
            'sos_incident_id' => $sosIncident->id,
            'lift_plan_id' => $liftPlan->id,
            'tbm_id' => $tbm->id,
            'hazard_id' => $hazardTicket->id,
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
