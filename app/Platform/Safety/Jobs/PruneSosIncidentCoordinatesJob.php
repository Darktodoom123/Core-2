<?php

namespace App\Platform\Safety\Jobs;

use App\Platform\Safety\Actions\PruneSosIncidentCoordinates;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class PruneSosIncidentCoordinatesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(PruneSosIncidentCoordinates $action): void
    {
        $action->handle();
    }
}
