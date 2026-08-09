<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Actions\CreateReportExportAction;
use App\Platform\Reporting\Actions\RetryReportExportAction;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Exports\ReportExportCatalog;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Jobs\PruneExpiredExportsJob;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Models\ReportExport;
use Carbon\CarbonInterface;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

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

function createExportReport(User $author, string $summary, CarbonInterface $createdAt): JobReport
{
    $job = DispatchJob::query()->create([
        'reference' => 'EXP-'.uniqid(),
        'client' => 'Export Client',
        'title' => 'Export job',
        'site' => 'Export site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHour(),
        'created_by' => $author->id,
        'version' => 1,
    ]);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $author->id,
        'work_summary' => $summary,
        'status' => 'submitted',
    ]);
    $report->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->saveQuietly();

    return $report;
}

function createQueuedExport(User $user, ReportExportType $type, string $format): ReportExport
{
    return ReportExport::query()->create([
        'user_id' => $user->id,
        'export_type' => $type,
        'format' => $format,
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
        'download_expires_at' => now()->addDay(),
        'purge_at' => now()->addDays(7),
    ]);
}

function createExportReportsInBulk(User $author, int $count): void
{
    $job = DispatchJob::query()->create([
        'reference' => 'BULK-'.uniqid(),
        'client' => 'Export Client',
        'title' => 'Bulk export job',
        'site' => 'Export site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHour(),
        'created_by' => $author->id,
        'version' => 1,
    ]);
    $timestamp = now()->toDateTimeString();
    $rows = [];

    for ($index = 1; $index <= $count; $index++) {
        $rows[] = [
            'dispatch_job_id' => $job->id,
            'author_id' => $author->id,
            'work_summary' => 'Representative export row '.$index,
            'status' => 'submitted',
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ];

        if (count($rows) === 500) {
            DB::table('job_reports')->insert($rows);
            $rows = [];
        }
    }

    if ($rows !== []) {
        DB::table('job_reports')->insert($rows);
    }
}

final class FailingCsvReportExportJob extends GenerateReportExportJob
{
    /** @param list<string> $headers
     * @param  iterable<list<string|int|float|null>>  $rows
     */
    protected function writeCsv(string $temporaryPath, array $headers, iterable $rows): int
    {
        Storage::disk('private')->put($temporaryPath, 'partial-export');

        throw new RuntimeException('C:\\private\\export.csv write failure');
    }
}

final class FailingPromotionReportExportJob extends GenerateReportExportJob
{
    protected function promote(string $temporaryPath, string $relativePath): void
    {
        throw new RuntimeException('Promotion failed');
    }
}

final class FailingChecksumReportExportJob extends GenerateReportExportJob
{
    protected function checksum(string $relativePath): string|false
    {
        return false;
    }
}

final class ObservingPromotionReportExportJob extends GenerateReportExportJob
{
    public bool $temporaryFileExistedBeforePromotion = false;

    public bool $finalFileExistedBeforePromotion = false;

    protected function promote(string $temporaryPath, string $relativePath): void
    {
        $this->temporaryFileExistedBeforePromotion = Storage::disk('private')->exists($temporaryPath);
        $this->finalFileExistedBeforePromotion = Storage::disk('private')->exists($relativePath);

        parent::promote($temporaryPath, $relativePath);
    }
}

final class ObservingPdfRendererJob extends GenerateReportExportJob
{
    public ?string $rendererTempDir = null;

    protected function pdfTemporaryDirectory(ReportExport $export): string
    {
        return $this->rendererTempDir = parent::pdfTemporaryDirectory($export);
    }

    /** @param list<string> $headers
     * @param  list<list<mixed>>  $rows
     */
    public function buildHtml(ReportExport $export, array $headers, array $rows): string
    {
        return $this->buildPdfHtml($export, $headers, $rows);
    }
}

final class FailingPdfRendererJob extends GenerateReportExportJob
{
    public ?string $rendererTempDir = null;

    protected function pdfTemporaryDirectory(ReportExport $export): string
    {
        return $this->rendererTempDir = parent::pdfTemporaryDirectory($export);
    }

    /** @param list<string> $headers
     * @param  list<list<mixed>>  $rows
     */
    protected function generatePdfContent(ReportExport $export, array $headers, array $rows, string $tempDir): string
    {
        throw new RuntimeException('mPDF renderer failure');
    }
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

it('writes formula-prefixed CSV values as inert text', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReport($manager, '=HYPERLINK("https://attacker.invalid")', now());

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

    expect(Storage::disk('private')->get($export->file_path))->toContain("'=HYPERLINK");
});

it('writes a valid private PDF for a scoped report export', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReport($manager, 'PDF-safe report summary', now());

    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'pdf',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
    ]);

    GenerateReportExportJob::dispatchSync($export->id);

    $export->refresh();
    expect($export->status)->toBe(ReportExportStatus::Completed)
        ->and($export->file_path)->toEndWith('.pdf')
        ->and(Storage::disk('private')->get($export->file_path))->toStartWith('%PDF-');
});

it('records CSV export integrity evidence after private generation', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);

    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
    ]);

    GenerateReportExportJob::dispatchSync($export->id);

    $export->refresh();
    expect($export->mime_type)->toBe('text/csv; charset=UTF-8')
        ->and($export->checksum_sha256)->toHaveLength(64)
        ->and($export->checksum_sha256)->toBe(hash('sha256', Storage::disk('private')->get($export->file_path)));
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
        ->get(URL::temporarySignedRoute('operations.exports.download', now()->addHour(), ['export' => $export->id]))
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

    expect(AuditEvent::query()->where('action', 'report_export.expired')->exists())->toBeTrue();
});

it('prunes retention files idempotently in bounded job batches', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);

    foreach (range(1, 101) as $index) {
        $path = "exports/expired-{$index}.csv";
        Storage::disk('private')->put($path, "Header\nValue");

        ReportExport::query()->create([
            'user_id' => $manager->id,
            'export_type' => ReportExportType::JobReports,
            'format' => 'csv',
            'status' => ReportExportStatus::Completed,
            'file_path' => $path,
            'purge_at' => now()->subMinute(),
        ]);
    }

    $job = new PruneExpiredExportsJob;
    $job->handle(app(RecordAuditEvent::class));
    $job->handle(app(RecordAuditEvent::class));

    expect($job->backoff)->toBe([60, 300])
        ->and(ReportExport::query()->where('status', ReportExportStatus::Expired)->count())->toBe(101)
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([])
        ->and(AuditEvent::query()->where('action', 'report_export.expired')->count())->toBe(101);
});

it('registers audited export retention cleanup with the scheduler', function (): void {
    expect(collect(app(Schedule::class)->events())
        ->map(static fn ($event): string => (string) $event->description)
        ->all())->toContain('reports:prune-expired');
});
it('rejects XLSX report export requests without creating an export record', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => 'job_reports',
            'format' => 'xlsx',
        ])
        ->assertSessionHasErrors('format');

    expect(ReportExport::query()->count())->toBe(0);
});

it('allows operations managers to request scoped fuel and maintenance exports', function (string $exportType): void {
    Queue::fake();
    $manager = createExportUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => $exportType,
            'format' => 'csv',
        ])
        ->assertRedirect();

    expect(ReportExport::query()->count())->toBe(1);
})->with(['fuel_logs', 'maintenance_logs']);

it('denies an operations manager a system audit export', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => 'system_audit',
            'format' => 'csv',
        ])
        ->assertForbidden();
});

it('separates 24-hour download expiry from seven-day export retention', function (): void {
    Queue::fake();
    $manager = createExportUser(RoleName::OperationsManager);

    $export = app(CreateReportExportAction::class)->execute(
        $manager,
        ReportExportType::JobReports,
        'csv',
    );

    expect($export->download_expires_at)->toEqual(now()->addDay()->startOfSecond())
        ->and($export->purge_at)->toEqual(now()->addDays(7)->startOfSecond());
});

it('prevents duplicate export jobs for an identical request', function (): void {
    Queue::fake();
    $manager = createExportUser(RoleName::OperationsManager);
    $action = app(CreateReportExportAction::class);

    $first = $action->execute($manager, ReportExportType::JobReports, 'csv');
    $second = $action->execute($manager, ReportExportType::JobReports, 'csv');

    expect($first->id)->toBe($second->id)
        ->and(ReportExport::query()->count())->toBe(1);
});

it('serializes duplicate export retries and dispatches only one generation job', function (): void {
    Queue::fake();
    $manager = createExportUser(RoleName::OperationsManager);
    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Failed,
        'error_message' => 'Previous attempt failed.',
        'expires_at' => now()->subHour(),
        'download_expires_at' => now()->subHour(),
        'purge_at' => now()->addDay(),
    ]);

    $action = app(RetryReportExportAction::class);
    $first = $action->execute($manager, $export);
    $second = $action->execute($manager, $export->fresh());

    expect($first['queued'])->toBeTrue()
        ->and($second['queued'])->toBeFalse()
        ->and($first['export']->id)->toBe($second['export']->id)
        ->and($second['export']->status)->toBe(ReportExportStatus::Queued)
        ->and(AuditEvent::query()->where('action', 'report_export.retried')->count())->toBe(1);

    Queue::assertPushed(GenerateReportExportJob::class, 1);
});

it('records bounded generation attempts and never reprocesses a completed export', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');
    $job = new GenerateReportExportJob($export->id);

    $job->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class));
    $job->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class));

    expect($export->fresh()->generation_attempts)->toBe(1)
        ->and($job->backoff)->toBe([10, 30]);

    $this->actingAs($manager)
        ->post("/operations/reports/exports/{$export->id}/retry")
        ->assertForbidden();
});

it('omits report export rows outside the validated date range', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReport($manager, 'outside date range', now()->subDays(2));
    createExportReport($manager, 'inside date range', now());

    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Queued,
        'filters' => ['date_from' => now()->toDateString(), 'date_to' => now()->toDateString()],
        'expires_at' => now()->addDay(),
    ]);

    GenerateReportExportJob::dispatchSync($export->id);

    $content = Storage::disk('private')->get($export->fresh()->file_path);

    expect($content)->toContain('inside date range')
        ->not->toContain('outside date range');
});

it('omits report export rows outside the requesting actor scope', function (): void {
    $actor = createExportUser(RoleName::Driver);
    $otherActor = createExportUser(RoleName::Driver);
    createExportReport($actor, 'visible report', now());
    createExportReport($otherActor, 'cross-scope report', now());

    $export = ReportExport::query()->create([
        'user_id' => $actor->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Queued,
        'expires_at' => now()->addDay(),
    ]);

    GenerateReportExportJob::dispatchSync($export->id);

    $content = Storage::disk('private')->get($export->fresh()->file_path);

    expect($content)->toContain('visible report')
        ->not->toContain('cross-scope report');
});

it('rejects an invalid export date range before a job is queued', function (): void {
    Queue::fake();
    $manager = createExportUser(RoleName::OperationsManager);

    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => 'job_reports',
            'format' => 'csv',
            'date_from' => '2026-08-09',
            'date_to' => '2026-08-08',
        ])
        ->assertSessionHasErrors('date_to');

    Queue::assertNothingPushed();
    expect(ReportExport::query()->count())->toBe(0);
});

it('generates the expected MIME type and file signature for every scoped dataset and format', function (RoleName $role, ReportExportType $type, string $format): void {
    $user = createExportUser($role);
    $export = createQueuedExport($user, $type, $format);
    GenerateReportExportJob::dispatchSync($export->id);

    $export->refresh();
    $content = Storage::disk('private')->get($export->file_path);

    expect($export->status)->toBe(ReportExportStatus::Completed)
        ->and($export->mime_type)->toBe($format === 'pdf' ? 'application/pdf' : 'text/csv; charset=UTF-8');

    if ($format === 'pdf') {
        expect($content)->toStartWith('%PDF-');
    } else {
        expect($content)->toContain('ID');
    }
})->with([
    'job reports CSV' => [RoleName::OperationsManager, ReportExportType::JobReports, 'csv'],
    'job reports PDF' => [RoleName::OperationsManager, ReportExportType::JobReports, 'pdf'],
    'dispatches CSV' => [RoleName::OperationsManager, ReportExportType::Dispatches, 'csv'],
    'dispatches PDF' => [RoleName::OperationsManager, ReportExportType::Dispatches, 'pdf'],
    'fuel logs CSV' => [RoleName::OperationsManager, ReportExportType::FuelLogs, 'csv'],
    'fuel logs PDF' => [RoleName::OperationsManager, ReportExportType::FuelLogs, 'pdf'],
    'maintenance logs CSV' => [RoleName::OperationsManager, ReportExportType::MaintenanceLogs, 'csv'],
    'maintenance logs PDF' => [RoleName::OperationsManager, ReportExportType::MaintenanceLogs, 'pdf'],
    'location audit CSV' => [RoleName::OperationsManager, ReportExportType::LocationAudit, 'csv'],
    'location audit PDF' => [RoleName::OperationsManager, ReportExportType::LocationAudit, 'pdf'],
    'system audit CSV' => [RoleName::SystemAdministrator, ReportExportType::SystemAudit, 'csv'],
    'system audit PDF' => [RoleName::SystemAdministrator, ReportExportType::SystemAudit, 'pdf'],
]);

it('uses an isolated private mPDF workspace and sends only escaped dataset text to the renderer', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReport($manager, '<img src="https://attacker.invalid/tracker.png">', now());
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'pdf');
    $job = new ObservingPdfRendererJob($export->id);

    $html = $job->buildHtml($export, ['Summary'], [['<img src="https://attacker.invalid/tracker.png">']]);
    $job->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class));

    expect($html)->toContain('&lt;img src=&quot;https://attacker.invalid/tracker.png&quot;&gt;')
        ->not->toContain('<img ')
        ->and($export->fresh()->status)->toBe(ReportExportStatus::Completed)
        ->and(Storage::disk('private')->get($export->fresh()->file_path))->toStartWith('%PDF-')
        ->and($job->rendererTempDir)->not->toBeNull()
        ->and($job->rendererTempDir)->toStartWith(Storage::disk('private')->path('export-tmp'))
        ->and(File::isDirectory($job->rendererTempDir))->toBeFalse();
});

it('reserves system audit exports for system administrators even when another role receives audit permission', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $manager->givePermissionTo(PermissionName::AuditView->value);

    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => ReportExportType::SystemAudit->value,
            'format' => 'csv',
        ])
        ->assertForbidden();

    expect(ReportExport::query()->count())->toBe(0);
});

it('cleans private PDF files and renderer workspace when mPDF fails', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'pdf');
    $job = new FailingPdfRendererJob($export->id);

    expect(fn () => $job->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class)))
        ->toThrow(RuntimeException::class);

    expect($export->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([])
        ->and($job->rendererTempDir)->not->toBeNull()
        ->and(File::isDirectory($job->rendererTempDir))->toBeFalse();
});

it('rechecks permission and account activity when queued export generation begins', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');
    $manager->update(['is_active' => false, 'suspended_at' => now()]);

    expect(fn () => GenerateReportExportJob::dispatchSync($export->id))
        ->toThrow(AuthorizationException::class);

    $export->refresh();
    expect($export->status)->toBe(ReportExportStatus::Failed)
        ->and($export->file_path)->toBeNull();
});

it('denies tampered and expired signed export download URLs', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $path = 'exports/signed-export.csv';
    Storage::disk('private')->put($path, "Header\nValue");
    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Completed,
        'file_path' => $path,
        'download_expires_at' => now()->addHour(),
        'expires_at' => now()->addHour(),
    ]);

    $valid = URL::temporarySignedRoute('operations.exports.download', now()->addHour(), ['export' => $export->id]);
    $expired = URL::temporarySignedRoute('operations.exports.download', now()->subMinute(), ['export' => $export->id]);

    $this->actingAs($manager)->get($valid.'&signature=tampered')->assertForbidden();
    $this->actingAs($manager)->get($expired)->assertForbidden();
});

it('denies signed download after the user is suspended or export permission is revoked', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $path = 'exports/revoked-export.csv';
    Storage::disk('private')->put($path, "Header\nValue");
    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Completed,
        'file_path' => $path,
        'download_expires_at' => now()->addHour(),
        'expires_at' => now()->addHour(),
    ]);
    $url = URL::temporarySignedRoute('operations.exports.download', now()->addHour(), ['export' => $export->id]);

    $manager->syncRoles([]);
    $this->actingAs($manager->fresh())->get($url)->assertForbidden();

    $manager->update(['is_active' => false, 'suspended_at' => now()]);
    $this->actingAs($manager->fresh())->get($url)->assertRedirect(route('login'));
});

it('does not expose a completed export when its private file is missing', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = ReportExport::query()->create([
        'user_id' => $manager->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Completed,
        'file_path' => 'exports/missing.csv',
        'download_expires_at' => now()->addHour(),
        'expires_at' => now()->addHour(),
    ]);

    $this->actingAs($manager)
        ->get(URL::temporarySignedRoute('operations.exports.download', now()->addHour(), ['export' => $export->id]))
        ->assertRedirect();
});

it('denies an unrelated authorized user from downloading a private export file', function (): void {
    $owner = createExportUser(RoleName::OperationsManager);
    $unrelated = createExportUser(RoleName::OperationsManager);
    $path = 'exports/owner-only.csv';
    Storage::disk('private')->put($path, "Header\nValue");
    $export = ReportExport::query()->create([
        'user_id' => $owner->id,
        'export_type' => ReportExportType::JobReports,
        'format' => 'csv',
        'status' => ReportExportStatus::Completed,
        'file_path' => $path,
        'download_expires_at' => now()->addHour(),
        'expires_at' => now()->addHour(),
    ]);

    $this->actingAs($unrelated)
        ->get(URL::temporarySignedRoute('operations.exports.download', now()->addHour(), ['export' => $export->id]))
        ->assertForbidden();
});

it('uses safe export headers for every dataset', function (ReportExportType $type): void {
    $headers = app(ReportExportCatalog::class)->dataset($type)->headers();
    $serializedHeaders = strtolower(implode('|', $headers));

    expect($serializedHeaders)
        ->not->toContain('path')
        ->not->toContain('secret')
        ->not->toContain('password')
        ->not->toContain('latitude')
        ->not->toContain('longitude')
        ->not->toContain('remark')
        ->not->toContain('reason');
})->with(ReportExportType::cases());

it('deletes a partial private file and redacts write failures', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');

    expect(fn () => (new FailingCsvReportExportJob($export->id))->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class)))
        ->toThrow(RuntimeException::class);

    $export->refresh();
    expect($export->status)->toBe(ReportExportStatus::Failed)
        ->and($export->error_message)->toBe('Export generation failed. Please retry or contact support.')
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([])
        ->and(AuditEvent::query()->where('action', 'report_export.failed')->exists())->toBeTrue();
});

it('deletes a temporary private file when atomic promotion fails', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');

    expect(fn () => (new FailingPromotionReportExportJob($export->id))->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class)))
        ->toThrow(RuntimeException::class);

    expect($export->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([]);
});

it('deletes the promoted private file when checksum evidence cannot be created', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');

    expect(fn () => (new FailingChecksumReportExportJob($export->id))->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class)))
        ->toThrow(RuntimeException::class);

    expect($export->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([]);
});

it('promotes a complete private temporary file atomically before recording completion', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReport($manager, 'Atomic promotion evidence', now());
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');
    $job = new ObservingPromotionReportExportJob($export->id);

    $job->handle(app(RecordAuditEvent::class), app(ReportExportCatalog::class));

    expect($job->temporaryFileExistedBeforePromotion)->toBeTrue()
        ->and($job->finalFileExistedBeforePromotion)->toBeFalse()
        ->and($export->fresh()->status)->toBe(ReportExportStatus::Completed)
        ->and(Storage::disk('private')->allFiles('exports'))->toHaveCount(1)
        ->and(Storage::disk('private')->allFiles('exports.'))->toBe([]);
});

it('rejects the 10,001st CSV row without leaving a private export file', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReportsInBulk($manager, 10001);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'csv');

    expect(fn () => GenerateReportExportJob::dispatchSync($export->id))->toThrow(LengthException::class);

    expect($export->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([]);
});

it('rejects the 1,001st PDF row without leaving a private export file', function (): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReportsInBulk($manager, 1001);
    $export = createQueuedExport($manager, ReportExportType::JobReports, 'pdf');

    expect(fn () => GenerateReportExportJob::dispatchSync($export->id))->toThrow(LengthException::class);

    expect($export->fresh()->status)->toBe(ReportExportStatus::Failed)
        ->and(Storage::disk('private')->allFiles('exports'))->toBe([]);
});

it('keeps representative CSV and PDF export memory within bounded thresholds', function (string $format, int $rows, int $maxAdditionalBytes): void {
    $manager = createExportUser(RoleName::OperationsManager);
    createExportReportsInBulk($manager, $rows);
    $export = createQueuedExport($manager, ReportExportType::JobReports, $format);
    $before = memory_get_usage(true);

    GenerateReportExportJob::dispatchSync($export->id);

    $additionalBytes = memory_get_usage(true) - $before;
    expect($export->fresh()->status)->toBe(ReportExportStatus::Completed)
        ->and($additionalBytes)->toBeLessThanOrEqual($maxAdditionalBytes);
})->with([
    'CSV representative volume' => ['csv', 5000, 24 * 1024 * 1024],
    'PDF representative volume' => ['pdf', 100, 32 * 1024 * 1024],
]);
