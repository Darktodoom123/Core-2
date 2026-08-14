<?php

namespace App\Modules\Dispatch\Contracts;

use App\Modules\Dispatch\Models\DispatchOutboxMessage;

interface DispatchOutboxDeliveryHandler
{
    public function handle(DispatchOutboxMessage $message): void;
}
