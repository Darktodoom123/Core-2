<?php

namespace App\Platform\Safety\Contracts;

use App\Platform\Safety\Models\SosIncident;

interface SosEscalationDelivery
{
    public function deliver(SosIncident $incident): void;
}
