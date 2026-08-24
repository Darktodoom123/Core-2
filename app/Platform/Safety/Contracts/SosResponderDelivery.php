<?php

namespace App\Platform\Safety\Contracts;

use App\Platform\Safety\Models\SosIncidentRecipient;

interface SosResponderDelivery
{
    public function deliver(SosIncidentRecipient $recipient): void;
}
