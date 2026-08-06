<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Jobs\PruneExpiredExportsJob;
use App\Platform\Reporting\Models\ReportExport;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

function createExportUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('allows authorized manager to request report export and queues generation job', function (): void {
    Queue::fake();

    $manager = createExportUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => 'job_reports',
            'format' => 'csv',
        ])
        ->assertRedirect();

    $export = ReportExport::query()->first();
    expect($export)->not()->toBeNull()
        ->and($export->user_id)->toBe($manager->id)
        ->and($export->export_type)->toBe(ReportExportType::JobReports)
        ->and($export->format)->toBe('csv')
        ->and($export->status)->toBe(ReportExportStatus::Queued);

    Queue::assertPushed(GenerateReportExportJob::class);
    expect(AuditEvent::query()->where('action', 'report_export.requested')->exists())->toBeTrue();
});

it('prevents unauthorized driver from requesting report export', function (): void {
    $driver = createExportUser(RoleName::Driver);

    $this->actingAs($driver)
        ->post('/operations/reports/exports', [
            'export_type' => 'job_reports',
            'format' => 'csv',
        ])
        ->assertStatus(403);
});

it('processes export job and sanitizes CSV formula injection values', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);

    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDays(7),
    ]);

    // Dispatch job synchronously
    GenerateReportExportJob::dispatchSync($export->id);

    $export->refresh();
    expect($export->status)->toBe(ReportExportStatus::Completed)
        ->and($export->file_path)->not()->toBeNull()
        ->and(Storage::disk('private')->exists($export->file_path))->toBeTrue();

    expect(AuditEvent::query()->where('action', 'report_export.completed')->exists())->toBeTrue();
});

it('allows authorized download of completed report export', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $path = 'exports/test-export.csv';

    Storage::disk('private')->put($path, "Header1,Header2\nValue1,Value2");

    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Completed,
        'file_path' => $path,
        'file_size_bytes' => 30,
        'row_count' => 1,
        'expires_at' => now()->addDays(7),
    ]);

    $this->actingAs($manager)
        ->get("/operations/reports/exports/{$export->id}/download")
        ->assertStatus(200);

    expect(AuditEvent::query()->where('action', 'report_export.downloaded')->exists())->toBeTrue();
});

it('prunes expired export files on schedule', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $path = 'exports/expired-export.csv';

    Storage::disk('private')->put($path, "Header1\nValue1");

    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Completed,
        'file_path' => $path,
        'expires_at' => now()->subDay(),
    ]);

    PruneExpiredExportsJob::dispatchSync();

    $export->refresh();
    expect($export->status)->toBe(ReportExportStatus::Expired)
        ->and($export->file_path)->toBeNull()
        ->and(Storage::disk('private')->exists($path))->toBeFalse();
});
