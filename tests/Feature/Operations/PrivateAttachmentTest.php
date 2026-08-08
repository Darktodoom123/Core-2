<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('local');
});

function createAttachUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('allows uploading a valid attachment and computes sha256 checksum', function (): void {
    $user = createAttachUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-001',
        'client' => 'Attachment Client',
        'title' => 'Attachment Dispatch',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    $file = UploadedFile::fake()->create('site_plan.pdf', 1024, 'application/pdf');

    $response = $this->actingAs($user)
        ->postJson('/operations/attachments', [
            'file' => $file,
            'owner_type' => 'dispatch_job',
            'owner_id' => $job->id,
            'kind' => 'blueprint',
        ]);

    $response->assertStatus(201);
    $attachment = Attachment::query()->first();

    expect($attachment)->not()->toBeNull()
        ->and($attachment->original_filename)->toBe('site_plan.pdf')
        ->and($attachment->mime_type)->toBe('application/pdf')
        ->and($attachment->checksum_sha256)->not()->toBeEmpty()
        ->and($attachment->disk)->toBe('local');

    Storage::disk('local')->assertExists($attachment->path);
    expect(AuditEvent::query()->where('action', 'attachment.uploaded')->exists())->toBeTrue();
});

it('rejects invalid upload types and oversized files', function (): void {
    $user = createAttachUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-002',
        'client' => 'Client',
        'title' => 'Title',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    // 1. Invalid MIME type (PHP script disguised as txt/html)
    $script = UploadedFile::fake()->create('malicious.php', 10, 'text/x-php');
    $this->actingAs($user)
        ->postJson('/operations/attachments', [
            'file' => $script,
            'owner_type' => 'dispatch_job',
            'owner_id' => $job->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['file']);

    // 2. Oversized file (>15MB)
    $bigFile = UploadedFile::fake()->create('huge.pdf', 16000, 'application/pdf');
    $this->actingAs($user)
        ->postJson('/operations/attachments', [
            'file' => $bigFile,
            'owner_type' => 'dispatch_job',
            'owner_id' => $job->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['file']);
});

it('enforces maximum limit of 10 attachments per owner record', function (): void {
    $user = createAttachUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-003',
        'client' => 'Client',
        'title' => 'Title',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    // Pre-populate 10 attachments
    for ($i = 0; $i < 10; $i++) {
        Attachment::query()->create([
            'owner_type' => (new DispatchJob)->getMorphClass(),
            'owner_id' => $job->id,
            'uploaded_by' => $user->id,
            'kind' => 'document',
            'disk' => 'local',
            'path' => "attachments/test/file_{$i}.pdf",
            'original_filename' => "file_{$i}.pdf",
            'mime_type' => 'application/pdf',
            'size_bytes' => 1024,
            'checksum_sha256' => md5("file_{$i}"),
        ]);
    }

    // 11th file should fail validation
    $file = UploadedFile::fake()->create('eleventh.pdf', 100, 'application/pdf');
    $this->actingAs($user)
        ->postJson('/operations/attachments', [
            'file' => $file,
            'owner_type' => 'dispatch_job',
            'owner_id' => $job->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['file']);
});

it('enforces file isolation preventing unauthorized user from downloading private attachment', function (): void {
    $uploader = createAttachUser(RoleName::Driver);
    $otherDriver = createAttachUser(RoleName::Driver);
    $manager = createAttachUser(RoleName::OperationsManager);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-ISO',
        'client' => 'Client',
        'title' => 'Title',
        'site' => 'Site',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $uploader->id,
        'version' => 1,
    ]);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $uploader->id,
        'work_summary' => 'Work summary',
        'status' => JobReportStatus::Submitted,
    ]);

    $fileContent = 'Confidential Report Content';
    $path = 'attachments/private/secret.pdf';
    Storage::disk('local')->put($path, $fileContent);

    $attachment = Attachment::query()->create([
        'owner_type' => (new JobReport)->getMorphClass(),
        'owner_id' => $report->id,
        'uploaded_by' => $uploader->id,
        'kind' => 'document',
        'disk' => 'local',
        'path' => $path,
        'original_filename' => 'secret.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => strlen($fileContent),
        'checksum_sha256' => hash('sha256', $fileContent),
    ]);

    // Unauthorized driver cannot download
    $this->actingAs($otherDriver)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(403);

    // Uploader can download and audit event is recorded
    $this->actingAs($uploader)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(200);

    expect(AuditEvent::query()->where('action', 'attachment.downloaded')->exists())->toBeTrue();

    // Manager can download
    $this->actingAs($manager)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(200);
});

it('returns not found when an authorized attachment file is missing from private storage', function (): void {
    $uploader = createAttachUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-MISSING',
        'client' => 'Client',
        'title' => 'Missing attachment',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $uploader->id,
        'version' => 1,
    ]);

    $attachment = Attachment::query()->create([
        'owner_type' => $job->getMorphClass(),
        'owner_id' => $job->id,
        'uploaded_by' => $uploader->id,
        'kind' => 'document',
        'disk' => 'local',
        'path' => 'attachments/missing.pdf',
        'original_filename' => 'missing.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 1,
        'checksum_sha256' => hash('sha256', 'missing'),
    ]);

    $this->actingAs($uploader)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertNotFound();
});
