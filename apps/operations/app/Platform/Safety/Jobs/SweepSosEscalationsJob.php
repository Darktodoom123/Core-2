<?php

namespace App\Platform\Safety\Jobs;

use App\Platform\Safety\Actions\EscalateUnacknowledgedSosIncident;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class SweepSosEscalationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(EscalateUnacknowledgedSosIncident $action): void
    {
        if (! (bool) config('sos.enabled')) {
            return;
        }

        SosIncident::query()->awaitingEscalation()
            ->orderBy('escalation_due_at')
            ->limit((int) config('sos.sweep_batch_size', 100))
            ->pluck('id')
            ->each(static fn (string $id): SosIncident => $action->handle($id));
    }
}
