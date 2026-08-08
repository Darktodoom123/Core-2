<?php

namespace App\Platform\Reporting\Jobs;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Exports\ReportExportCatalog;
use App\Platform\Reporting\Models\ReportExport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;
use Mpdf\Mpdf;
use Mpdf\Output\Destination;
use Throwable;

class GenerateReportExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [10, 30];

    public int $timeout = 300;

    public function __construct(
        public readonly string $exportId
    ) {}

    public function handle(RecordAuditEvent $recordAudit, ReportExportCatalog $catalog): void
    {
        $export = DB::transaction(function (): ?ReportExport {
            $lockedExport = ReportExport::query()->lockForUpdate()->find($this->exportId);
            if (! $lockedExport instanceof ReportExport || $lockedExport->status !== ReportExportStatus::Queued) {
                return null;
            }

            $lockedExport->update([
                'status' => ReportExportStatus::Processing,
                'started_at' => now(),
                'generation_attempts' => $lockedExport->generation_attempts + 1,
            ]);

            return $lockedExport->fresh();
        });

        if (! $export instanceof ReportExport) {
            return;
        }

        $temporaryPath = null;
        $relativePath = null;

        try {
            $user = $export->user;
            $catalog->authorize($user, $export->export_type);
            $dataset = $catalog->dataset($export->export_type);
            $format = strtolower($export->format);
            $filename = $export->export_type->filenamePrefix().'-'.$export->id.'.'.$format;
            $relativePath = 'exports/'.$filename;

            $temporaryPath = 'exports/.'.$filename.'.part';
            $headers = $dataset->headers();
            $rows = $dataset->rows($user, $export->filters ?? []);

            $rowCount = match ($format) {
                'csv' => $this->writeCsv($temporaryPath, $headers, $rows),
                'pdf' => $this->writePdf($temporaryPath, $export, $headers, $rows),
                default => throw new \InvalidArgumentException('Unsupported export format.'),
            };
            $this->promote($temporaryPath, $relativePath);
            $temporaryPath = null;

            $fileSize = Storage::disk('private')->size($relativePath);
            $checksum = $this->checksum($relativePath);
            if ($checksum === false) {
                throw new \RuntimeException('Unable to calculate export checksum.');
            }

            $export->update([
                'status' => ReportExportStatus::Completed,
                'file_path' => $relativePath,
                'file_size_bytes' => $fileSize,
                'mime_type' => $format === 'pdf' ? 'application/pdf' : 'text/csv; charset=UTF-8',
                'checksum_sha256' => $checksum,
                'row_count' => $rowCount,
                'completed_at' => now(),
            ]);

            $recordAudit->handle(
                actor: $user,
                subject: $export,
                action: 'report_export.completed',
                after: [
                    'file_path' => $relativePath,
                    'row_count' => $rowCount,
                    'file_size_bytes' => $fileSize,
                ]
            );
        } catch (Throwable $e) {
            if ($temporaryPath !== null && Storage::disk('private')->exists($temporaryPath)) {
                Storage::disk('private')->delete($temporaryPath);
            }
            if ($relativePath !== null && Storage::disk('private')->exists($relativePath)) {
                Storage::disk('private')->delete($relativePath);
            }

            $export->update([
                'status' => ReportExportStatus::Failed,
                'error_message' => 'Export generation failed. Please retry or contact support.',
            ]);

            $recordAudit->handle(
                actor: $export->user,
                subject: $export,
                action: 'report_export.failed',
                after: [
                    'reason' => class_basename($e),
                ]
            );

            throw $e;
        }
    }

    /** @param list<string> $headers
     * @param  iterable<list<string|int|float|null>>  $rows
     */
    protected function writeCsv(string $temporaryPath, array $headers, iterable $rows): int
    {
        $stream = tmpfile();
        if ($stream === false) {
            throw new \RuntimeException('Unable to open private export stream.');
        }

        fputcsv($stream, array_map([$this, 'sanitizeCsvValue'], $headers));
        $rowCount = 0;
        foreach ($rows as $row) {
            if (++$rowCount > 10000) {
                fclose($stream);
                throw new \LengthException('The export exceeds the 10,000 row limit.');
            }
            fputcsv($stream, array_map([$this, 'sanitizeCsvValue'], $row));
        }

        rewind($stream);
        Storage::disk('private')->put($temporaryPath, $stream);
        fclose($stream);

        return $rowCount;
    }

    /** @param list<string> $headers
     * @param  iterable<list<string|int|float|null>>  $rows
     */
    protected function writePdf(string $temporaryPath, ReportExport $export, array $headers, iterable $rows): int
    {
        $boundedRows = [];
        foreach ($rows as $row) {
            if (count($boundedRows) >= 1000) {
                throw new \LengthException('PDF exports are limited to 1,000 rows. Use CSV for larger exports.');
            }
            $boundedRows[] = $row;
        }

        $rendererTempDir = $this->pdfTemporaryDirectory($export);

        try {
            Storage::disk('private')->put($temporaryPath, $this->generatePdfContent($export, $headers, $boundedRows, $rendererTempDir));
        } finally {
            File::deleteDirectory($rendererTempDir);
        }

        return count($boundedRows);
    }

    /**
     * mPDF creates and mutates font-cache data under its temporary directory.
     * A per-export directory prevents concurrent workers from racing on that
     * cache while keeping all renderer artifacts on the private disk.
     */
    protected function pdfTemporaryDirectory(ReportExport $export): string
    {
        $directory = Storage::disk('private')->path('export-tmp/'.$export->id);
        File::ensureDirectoryExists($directory, 0700, true);

        return $directory;
    }

    /**
     * Render only server-authored, escaped text. No remote assets, templates,
     * paths, or user-provided HTML are accepted by this writer.
     *
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    protected function generatePdfContent(ReportExport $export, array $headers, array $rows, string $tempDir): string
    {
        $defaultConfig = (new ConfigVariables)->getDefaults();
        $fontConfig = (new FontVariables)->getDefaults();

        $pdf = new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'tempDir' => $tempDir,
            'fontDir' => $defaultConfig['fontDir'],
            'fontdata' => $fontConfig['fontdata'],
            'default_font' => 'dejavusanscondensed',
        ]);

        $pdf->WriteHTML($this->buildPdfHtml($export, $headers, $rows));

        return $pdf->Output('', Destination::STRING_RETURN);
    }

    /**
     * Render only server-authored markup. Dataset values are text nodes, never
     * trusted HTML, stylesheets, paths, or assets supplied by a requester.
     *
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    protected function buildPdfHtml(ReportExport $export, array $headers, array $rows): string
    {

        $headerHtml = implode('', array_map(
            fn (string $header): string => '<th>'.$this->escapeHtml($header).'</th>',
            $headers,
        ));
        $rowHtml = implode('', array_map(function (array $row): string {
            return '<tr>'.implode('', array_map(
                fn (mixed $value): string => '<td>'.$this->escapeHtml($value).'</td>',
                $row,
            )).'</tr>';
        }, $rows));

        $html = '<!doctype html><html><head><meta charset="utf-8"><style>'
            .'body{font-family:sans-serif;font-size:9pt}table{border-collapse:collapse;width:100%}'
            .'th,td{border:1px solid #555;padding:4px;text-align:left}th{background:#eee}</style></head><body>'
            .'<h1>'.$this->escapeHtml($export->export_type->label()).'</h1>'
            .'<p>Generated '.now()->toIso8601String().'</p>'
            .'<table><thead><tr>'.$headerHtml.'</tr></thead><tbody>'.$rowHtml.'</tbody></table>'
            .'</body></html>';

        return $html;
    }

    private function sanitizeCsvValue(mixed $value): string
    {
        $str = (string) ($value ?? '');

        if ($str === '') {
            return '';
        }

        // Prevent CSV / Excel formula injection (CVE-2014-3524)
        $firstChar = substr($str, 0, 1);
        if (in_array($firstChar, ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$str;
        }

        return $str;
    }

    private function escapeHtml(mixed $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    protected function promote(string $temporaryPath, string $relativePath): void
    {
        Storage::disk('private')->move($temporaryPath, $relativePath);
    }

    protected function checksum(string $relativePath): string|false
    {
        return hash_file('sha256', Storage::disk('private')->path($relativePath));
    }
}
