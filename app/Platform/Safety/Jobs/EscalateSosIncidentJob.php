<?php

namespace App\Platform\Safety\Jobs;

use App\Platform\Safety\Actions\EscalateUnacknowledgedSosIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class EscalateSosIncidentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $incidentId)
    {
        $this->onQueue((string) config('sos.queue', 'emergency'));
    }

    public function handle(EscalateUnacknowledgedSosIncident $action): void
    {
        $action->handle($this->incidentId);
    }
}
