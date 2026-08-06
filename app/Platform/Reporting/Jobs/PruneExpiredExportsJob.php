<?php

namespace App\Platform\Reporting\Jobs;

use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Models\ReportExport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class PruneExpiredExportsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $expiredExports = ReportExport::query()
            ->where('status', '!=', ReportExportStatus::Expired->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->get();

        foreach ($expiredExports as $export) {
            if ($export->file_path && Storage::disk('private')->exists($export->file_path)) {
                Storage::disk('private')->delete($export->file_path);
            }

            $export->update([
                'status' => ReportExportStatus::Expired,
                'file_path' => null,
            ]);
        }
    }
}
