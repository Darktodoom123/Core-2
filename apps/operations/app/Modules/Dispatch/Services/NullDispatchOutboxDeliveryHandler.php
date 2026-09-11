<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Contracts\DispatchOutboxDeliveryHandler;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;

final class NullDispatchOutboxDeliveryHandler implements DispatchOutboxDeliveryHandler
{
    public function handle(DispatchOutboxMessage $message): void
    {
        // Source callbacks, notifications, and projections may subscribe to the outbox event.
    }
}
