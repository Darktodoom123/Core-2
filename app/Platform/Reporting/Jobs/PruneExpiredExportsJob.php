<?php

namespace App\Platform\Reporting\Jobs;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Models\ReportExport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneExpiredExportsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const CHUNK_SIZE = 100;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function handle(RecordAuditEvent $recordAudit): void
    {
        ReportExport::query()
            ->select('id')
            ->where('status', '!=', ReportExportStatus::Expired->value)
            ->where(function ($query): void {
                $query->where('purge_at', '<', now())
                    ->orWhere(function ($legacyQuery): void {
                        $legacyQuery->whereNull('purge_at')
                            ->where('expires_at', '<', now());
                    });
            })
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($exports) use ($recordAudit): void {
                foreach ($exports as $export) {
                    $this->prune($export->id, $recordAudit);
                }
            });
    }

    private function prune(string $exportId, RecordAuditEvent $recordAudit): void
    {
        DB::transaction(function () use ($exportId, $recordAudit): void {
            $export = ReportExport::query()->lockForUpdate()->find($exportId);
            if (! $export instanceof ReportExport || ! $this->isDueForPurge($export)) {
                return;
            }

            if ($export->file_path !== null && Storage::disk('private')->exists($export->file_path)) {
                Storage::disk('private')->delete($export->file_path);
            }

            $export->update([
                'status' => ReportExportStatus::Expired,
                'file_path' => null,
                'request_fingerprint' => null,
            ]);

            $recordAudit->handle(
                actor: $export->user,
                subject: $export,
                action: 'report_export.expired',
                after: ['purge_at' => $export->purge_at?->toIso8601String()],
            );
        });
    }

    private function isDueForPurge(ReportExport $export): bool
    {
        if ($export->status === ReportExportStatus::Expired) {
            return false;
        }

        return $export->purge_at?->isPast()
            ?? ($export->expires_at?->isPast() ?? false);
    }
}
