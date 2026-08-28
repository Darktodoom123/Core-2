<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Attachments\Jobs\PruneExpiredAttachmentsJob;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

function createAttachUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('allows uploading a valid attachment and computes sha256 checksum', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
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
        ->and($attachment->disk)->toBe('private')
        ->and($attachment->path)->toEndWith('.pdf')
        ->and($attachment->retention_until)->not()->toBeNull()
        ->and($attachment->retention_until->isFuture())->toBeTrue();

    Storage::disk('private')->assertExists($attachment->path);
    expect(AuditEvent::query()->where('action', 'attachment.uploaded')->exists())->toBeTrue();
});

it('rejects invalid upload types and oversized files', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
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

it('rejects empty files and stores generated paths without traversal segments', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-BOUNDARY',
        'client' => 'Client',
        'title' => 'Boundary test',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    $emptyFile = Mockery::mock(UploadedFile::class);
    $emptyFile->shouldReceive('isValid')->andReturnTrue();
    $emptyFile->shouldReceive('getClientOriginalName')->andReturn('empty.pdf');
    $emptyFile->shouldReceive('getSize')->andReturn(0);
    $emptyFile->shouldReceive('getMimeType')->andReturn('application/pdf');

    expect(fn () => app(UploadAttachmentAction::class)->execute($user, $job, $emptyFile))
        ->toThrow(InvalidArgumentException::class, 'File cannot be empty.');

    $traversalPath = tempnam(sys_get_temp_dir(), 'core2-traversal-');
    if ($traversalPath === false) {
        throw new RuntimeException('Unable to create a traversal-file fixture.');
    }
    file_put_contents($traversalPath, '%PDF-1.4 unsafe name');
    $traversalFile = new UploadedFile($traversalPath, '../receipt.pdf', 'application/pdf', UPLOAD_ERR_OK, true);

    $attachment = app(UploadAttachmentAction::class)->execute($user, $job, $traversalFile);
    unlink($traversalPath);

    expect($attachment->path)->not->toContain('..')
        ->and($attachment->path)->not->toContain('receipt.pdf')
        ->and($attachment->original_filename)->toBe('receipt.pdf');
});

it('uses the detected MIME type rather than the client-provided extension', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-MIME',
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

    $response = $this->actingAs($user)->postJson('/operations/attachments', [
        'file' => UploadedFile::fake()->create('misleading.jpg', 20, 'application/pdf'),
        'owner_type' => 'dispatch_job',
        'owner_id' => $job->id,
    ]);

    $response->assertCreated();

    $attachment = Attachment::query()->sole();
    expect($attachment->mime_type)->toBe('application/pdf')
        ->and($attachment->path)->toEndWith('.pdf');
});

it('enforces maximum limit of 10 attachments per owner record', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
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
    $uploader = createAttachUser(RoleName::CraneOperator);
    $otherDriver = createAttachUser(RoleName::CraneOperator);
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
    Storage::disk('private')->put($path, $fileContent);

    $attachment = Attachment::query()->create([
        'owner_type' => (new JobReport)->getMorphClass(),
        'owner_id' => $report->id,
        'uploaded_by' => $uploader->id,
        'kind' => 'document',
        'disk' => 'private',
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
    $uploader = createAttachUser(RoleName::OperationsManager);
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
        'disk' => 'private',
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

it('prunes expired generic attachments idempotently and records an audit event', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-RETENTION',
        'client' => 'Client',
        'title' => 'Retention dispatch',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    Storage::disk('private')->put('attachments/expired.pdf', 'expired');
    Storage::disk('private')->put('attachments/active.pdf', 'active');

    $expired = Attachment::query()->create([
        'owner_type' => $job->getMorphClass(),
        'owner_id' => $job->id,
        'uploaded_by' => $user->id,
        'kind' => 'document',
        'disk' => 'private',
        'path' => 'attachments/expired.pdf',
        'original_filename' => 'expired.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 7,
        'checksum_sha256' => hash('sha256', 'expired'),
        'retention_until' => now()->subMinute(),
    ]);
    $active = Attachment::query()->create([
        'owner_type' => $job->getMorphClass(),
        'owner_id' => $job->id,
        'uploaded_by' => $user->id,
        'kind' => 'document',
        'disk' => 'private',
        'path' => 'attachments/active.pdf',
        'original_filename' => 'active.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 6,
        'checksum_sha256' => hash('sha256', 'active'),
        'retention_until' => now()->addDay(),
    ]);

    (new PruneExpiredAttachmentsJob)->handle(app(RecordAuditEvent::class));

    expect(Attachment::query()->find($expired->id))->toBeNull()
        ->and(Attachment::query()->find($active->id))->not()->toBeNull()
        ->and(Storage::disk('private')->exists('attachments/expired.pdf'))->toBeFalse()
        ->and(Storage::disk('private')->exists('attachments/active.pdf'))->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'attachment.expired')->count())->toBe(1);

    (new PruneExpiredAttachmentsJob)->handle(app(RecordAuditEvent::class));

    expect(AuditEvent::query()->where('action', 'attachment.expired')->count())->toBe(1);
});

it('prunes expired fuel receipts and clears the fuel log path', function (): void {
    $user = createAttachUser(RoleName::CraneOperator);
    $fuel = FuelRequest::query()->create([
        'reference' => 'FUEL-ATT-RETENTION',
        'requester_id' => $user->id,
        'quantity_litres' => 20,
        'fuel_type' => 'diesel',
        'purpose' => 'Retention test',
        'status' => FuelRequestStatus::Logged,
    ]);
    $path = 'attachments/fuel-expired.pdf';
    Storage::disk('private')->put($path, 'receipt');
    $log = FuelLog::query()->create([
        'fuel_request_id' => $fuel->id,
        'recorded_by' => $user->id,
        'quantity_litres' => 20,
        'receipt_path' => $path,
        'recorded_at' => now(),
    ]);
    $attachment = Attachment::query()->create([
        'owner_type' => $log->getMorphClass(),
        'owner_id' => $log->id,
        'uploaded_by' => $user->id,
        'kind' => 'fuel_receipt',
        'disk' => 'private',
        'path' => $path,
        'original_filename' => 'receipt.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 7,
        'checksum_sha256' => hash('sha256', 'receipt'),
        'retention_until' => now()->subDay(),
    ]);

    (new PruneExpiredAttachmentsJob)->handle(app(RecordAuditEvent::class));

    expect(Attachment::query()->find($attachment->id))->toBeNull()
        ->and($log->fresh()->receipt_path)->toBeNull()
        ->and(Storage::disk('private')->exists($path))->toBeFalse()
        ->and(AuditEvent::query()->where('action', 'attachment.expired')->exists())->toBeTrue();
});

it('registers bounded attachment retention cleanup with the scheduler', function (): void {
    expect(collect(app(Schedule::class)->events())
        ->contains(fn ($event): bool => str_contains($event->description ?? '', 'attachments:prune-expired')))
        ->toBeTrue();
});

it('removes the stored file when audit persistence fails after upload', function (): void {
    $user = createAttachUser(RoleName::OperationsManager);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-ATT-AUDIT-FAIL',
        'client' => 'Client',
        'title' => 'Audit failure',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    DB::listen(function (QueryExecuted $query): void {
        if (str_contains(strtolower($query->sql), 'insert into "audit_events"')) {
            throw new RuntimeException('simulated audit persistence failure');
        }
    });

    $this->actingAs($user)
        ->postJson('/operations/attachments', [
            'file' => UploadedFile::fake()->create('audit-failure.pdf', 10, 'application/pdf'),
            'owner_type' => 'dispatch_job',
            'owner_id' => $job->id,
        ])
        ->assertServerError();

    expect(Attachment::query()->count())->toBe(0)
        ->and(Storage::disk('private')->allFiles())->toBe([]);
});
