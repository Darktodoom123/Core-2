<?php

namespace App\Platform\Safety\Data;

use App\Platform\Safety\Models\SosIncident;

final readonly class SosTriggerResult
{
    public function __construct(
        public SosIncident $incident,
        public bool $created,
        public bool $reusedActiveIncident = false,
    ) {}
}
