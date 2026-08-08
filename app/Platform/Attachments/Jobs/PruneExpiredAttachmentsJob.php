<?php

namespace App\Platform\Attachments\Jobs;

use App\Modules\Fuel\Models\FuelLog;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Actions\RecordAuditEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

final class PruneExpiredAttachmentsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    private const CHUNK_SIZE = 100;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function handle(RecordAuditEvent $audit): void
    {
        Attachment::query()
            ->select('id')
            ->whereNotNull('retention_until')
            ->where('retention_until', '<=', now())
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function ($attachments) use ($audit): void {
                foreach ($attachments as $attachment) {
                    $this->prune((int) $attachment->id, $audit);
                }
            });
    }

    private function prune(int $attachmentId, RecordAuditEvent $audit): void
    {
        DB::transaction(function () use ($attachmentId, $audit): void {
            $attachment = Attachment::query()->lockForUpdate()->find($attachmentId);
            if ($attachment === null || $attachment->retention_until === null) {
                return;
            }

            $retentionUntil = Carbon::parse((string) $attachment->retention_until);
            if ($retentionUntil->isFuture()) {
                return;
            }

            $disk = Storage::disk($attachment->disk);
            if ($disk->exists($attachment->path) && ! $disk->delete($attachment->path)) {
                throw new RuntimeException('Unable to remove expired attachment from private storage.');
            }

            $owner = $attachment->owner;
            if ($owner instanceof FuelLog && $owner->receipt_path === $attachment->path) {
                $owner->update(['receipt_path' => null]);
            }

            $audit->handle(
                actor: $attachment->uploader()->firstOrFail(),
                subject: $attachment,
                action: 'attachment.expired',
                before: [
                    'path' => $attachment->path,
                    'owner_type' => $attachment->owner_type,
                    'owner_id' => $attachment->owner_id,
                    'retention_until' => $retentionUntil->toIso8601String(),
                ],
                after: ['storage_deleted' => true],
            );

            $attachment->delete();
        });
    }
}
